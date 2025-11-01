import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatSession, ChatMessage } from '../../features/chat/models/chat-session.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${environment.apiUrl}/chat`;

  // State signals
  sessions = signal<ChatSession[]>([]);
  currentSessionId = signal<string | null>(null);
  messages = signal<ChatMessage[]>([]);
  isStreaming = signal(false);

  // Computed signals
  currentSession = computed(() => {
    const sessionId = this.currentSessionId();
    return this.sessions().find(s => s.id === sessionId) || null;
  });

  hasMessages = computed(() => this.messages().length > 0);

  constructor() {
    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.sessions.set([]);
      this.messages.set([]);
    });
  }

  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<ChatSession> {
    const response = await firstValueFrom(
      this.http.post<ChatSession>(`${this.apiUrl}/sessions`, { title })
    );

    // Add to sessions list
    this.sessions.update(sessions => [response, ...sessions]);

    // Set as current session
    this.currentSessionId.set(response.id);
    this.messages.set([]);

    return response;
  }

  /**
   * Load all chat sessions
   */
  async loadSessions(): Promise<ChatSession[]> {
    const sessions = await firstValueFrom(
      this.http.get<ChatSession[]>(`${this.apiUrl}/sessions`)
    );

    this.sessions.set(sessions);
    return sessions;
  }

  /**
   * Load a specific session with its messages
   */
  async loadSession(sessionId: string): Promise<ChatSession> {
    const session = await firstValueFrom(
      this.http.get<ChatSession>(`${this.apiUrl}/sessions/${sessionId}`)
    );

    // Update current session
    this.currentSessionId.set(sessionId);

    // Convert date strings to Date objects
    const messages = (session.messages || []).map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt)
    }));

    this.messages.set(messages);

    return session;
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/sessions/${sessionId}`)
    );

    // Remove from sessions list
    this.sessions.update(sessions =>
      sessions.filter(s => s.id !== sessionId)
    );

    // Clear current session if it was deleted
    if (this.currentSessionId() === sessionId) {
      this.currentSessionId.set(null);
      this.messages.set([]);
    }
  }

  /**
   * Send a message and stream the response using SSE
   */
  async sendMessage(sessionId: string, content: string): Promise<void> {
    // Add user message immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content,
      createdAt: new Date()
    };

    this.messages.update(msgs => [...msgs, userMessage]);
    this.isStreaming.set(true);

    try {
      // Stream the assistant response
      let assistantContent = '';

      for await (const chunk of this.streamResponse(sessionId, content)) {
        assistantContent += chunk;

        // Update or create assistant message
        this.messages.update(msgs => {
          const lastMsg = msgs[msgs.length - 1];

          if (lastMsg && lastMsg.role === 'assistant') {
            // Update existing assistant message
            return [
              ...msgs.slice(0, -1),
              { ...lastMsg, content: assistantContent }
            ];
          } else {
            // Create new assistant message
            return [
              ...msgs,
              {
                role: 'assistant' as const,
                content: assistantContent,
                createdAt: new Date()
              }
            ];
          }
        });
      }

      // Reload session to get the final saved message with sources
      await this.loadSession(sessionId);

    } catch (error) {
      console.error('Error streaming message:', error);

      // Add error message
      this.messages.update(msgs => [
        ...msgs,
        {
          role: 'assistant' as const,
          content: 'Sorry, I encountered an error processing your message. Please try again.',
          createdAt: new Date()
        }
      ]);
    } finally {
      this.isStreaming.set(false);
    }
  }

  /**
   * Stream response from the backend using fetch API
   */
  private async *streamResponse(sessionId: string, message: string): AsyncGenerator<string> {
    const response = await fetch(`${this.apiUrl}/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();

            // Check for completion signal
            if (data === '[DONE]') {
              return;
            }

            try {
              const json = JSON.parse(data);
              if (json.chunk) {
                yield json.chunk;
              }
            } catch (e) {
              // Skip malformed JSON
              console.warn('Skipping malformed JSON:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Switch to a different session
   */
  async switchSession(sessionId: string): Promise<void> {
    await this.loadSession(sessionId);
  }

  /**
   * Clear current session
   */
  clearCurrentSession(): void {
    this.currentSessionId.set(null);
    this.messages.set([]);
  }
}
