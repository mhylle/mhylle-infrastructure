import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SearchService } from '@features/search/services/search.service';
import { LocalModelService } from '@features/llm-service/services/local-model.service';
import { ChatService } from './chat.service';
import { SearchResultDto } from '@features/search/dto/search.dto';
import { ChatMessage, MessageSource } from '../entities/chat-message.entity';

export interface RAGQueryResult {
  stream: Observable<string>;
  sources: MessageSource[];
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly localModelService: LocalModelService,
    private readonly chatService: ChatService,
  ) {}

  async query(query: string, sessionId: string): Promise<RAGQueryResult> {
    this.logger.log(`RAG query for session ${sessionId}: "${query}"`);

    // 1. Retrieve relevant notes using semantic search
    const relevantNotes = await this.semanticSearch(query);
    this.logger.log(`Found ${relevantNotes.length} relevant notes`);

    // 2. Get conversation history
    const history = await this.chatService.getHistory(sessionId, 10);
    this.logger.log(`Retrieved ${history.length} messages from history`);

    // 3. Build context-aware prompt
    const prompt = this.buildPrompt(query, relevantNotes, history);

    // 4. Create sources metadata
    const sources: MessageSource[] = relevantNotes.map((note) => ({
      noteId: note.id,
      title: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
      relevanceScore: note.score,
    }));

    // 5. Stream LLM response
    const stream = this.localModelService.generateStreamingCompletion({
      prompt,
      systemPrompt: this.getSystemPrompt(),
    });

    return {
      stream,
      sources,
    };
  }

  private async semanticSearch(query: string): Promise<SearchResultDto[]> {
    try {
      const searchResult = await this.searchService.search({
        query,
        mode: 'semantic' as any,
        limit: 5,
        minScore: 0.6,
      });

      return searchResult.results;
    } catch (error) {
      this.logger.error(`Semantic search failed: ${error.message}`, error.stack);
      return [];
    }
  }

  private getSystemPrompt(): string {
    return `You are a helpful AI assistant with access to the user's personal notes.
Your role is to answer questions based on the provided notes and conversation history.

Guidelines:
- Always base your answers on the provided notes context
- If the notes don't contain relevant information, clearly state that
- Be concise but informative
- When referencing information from notes, briefly mention which note it came from
- Maintain conversation context from the history
- Be honest about limitations - don't make up information`;
  }

  private buildPrompt(
    query: string,
    notes: SearchResultDto[],
    history: ChatMessage[],
  ): string {
    const parts: string[] = [];

    // Add relevant notes as context
    if (notes.length > 0) {
      parts.push('=== Relevant Notes ===');
      notes.forEach((note, index) => {
        const preview = note.content.substring(0, 300);
        parts.push(`\nNote ${index + 1} (relevance: ${(note.score * 100).toFixed(1)}%):`);
        parts.push(preview + (note.content.length > 300 ? '...' : ''));
      });
      parts.push('\n=== End of Notes ===\n');
    } else {
      parts.push('=== No Relevant Notes Found ===\n');
    }

    // Add conversation history (in reverse order, most recent first)
    if (history.length > 0) {
      parts.push('=== Recent Conversation ===');
      // Reverse to show oldest first
      [...history].reverse().forEach((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        parts.push(`${role}: ${msg.content}`);
      });
      parts.push('=== End of Conversation ===\n');
    }

    // Add current query
    parts.push(`Current Question: ${query}`);
    parts.push('\nPlease provide a helpful answer based on the notes and conversation context above.');

    return parts.join('\n');
  }
}
