import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { ChatService } from '../../core/services/chat.service';
import { SessionListComponent } from './components/session-list/session-list.component';
import { MessageListComponent } from './components/message-list/message-list.component';
import { ChatInputComponent } from './components/chat-input/chat-input.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    SessionListComponent,
    MessageListComponent,
    ChatInputComponent
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // Expose service signals to template
  sessions = this.chatService.sessions;
  currentSessionId = this.chatService.currentSessionId;
  messages = this.chatService.messages;
  isStreaming = this.chatService.isStreaming;

  ngOnInit(): void {
    this.loadSessions();
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessions = await this.chatService.loadSessions();

      // Auto-select first session if available
      if (sessions.length > 0 && !this.currentSessionId()) {
        await this.chatService.loadSession(sessions[0].id);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      this.showError('Failed to load chat sessions');
    }
  }

  async onNewSession(): Promise<void> {
    try {
      await this.chatService.createSession();
      this.showSuccess('New chat session created');
    } catch (error) {
      console.error('Error creating session:', error);
      this.showError('Failed to create new session');
    }
  }

  async onSelectSession(sessionId: string): Promise<void> {
    if (sessionId === this.currentSessionId()) {
      return; // Already selected
    }

    try {
      await this.chatService.switchSession(sessionId);
    } catch (error) {
      console.error('Error switching session:', error);
      this.showError('Failed to load session');
    }
  }

  async onDeleteSession(sessionId: string): Promise<void> {
    try {
      await this.chatService.deleteSession(sessionId);
      this.showSuccess('Chat session deleted');

      // Create new session if no sessions left
      if (this.sessions().length === 0) {
        await this.onNewSession();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showError('Failed to delete session');
    }
  }

  async onSendMessage(content: string): Promise<void> {
    const sessionId = this.currentSessionId();

    if (!sessionId) {
      // Create a new session if none exists
      const newSession = await this.chatService.createSession();
      await this.chatService.sendMessage(newSession.id, content);
      return;
    }

    try {
      await this.chatService.sendMessage(sessionId, content);
    } catch (error) {
      console.error('Error sending message:', error);
      this.showError('Failed to send message. Please try again.');
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }
}
