import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { RAGService } from '../services/rag.service';
import { CreateSessionDto } from '../dto/create-session.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  ChatSessionResponseDto,
  ChatMessageResponseDto,
} from '../dto/chat-response.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly ragService: RAGService,
  ) {}

  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSessionResponseDto> {
    this.logger.log('Creating new chat session');
    const session = await this.chatService.createSession(dto.title);

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Get('sessions')
  async listSessions(): Promise<ChatSessionResponseDto[]> {
    this.logger.log('Listing all chat sessions');
    const sessions = await this.chatService.findAllSessions();

    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<ChatSessionResponseDto> {
    this.logger.log(`Retrieving session ${id}`);
    const session = await this.chatService.findSessionById(id);

    const messages: ChatMessageResponseDto[] = session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sources: msg.sources,
      createdAt: msg.createdAt,
    }));

    return {
      id: session.id,
      title: session.title,
      messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Deleting session ${id}`);
    await this.chatService.deleteSession(id);
    return { message: 'Session deleted successfully' };
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    this.logger.log(`Sending message to session ${sessionId}`);

    try {
      // 1. Save user message
      await this.chatService.saveMessage({
        sessionId,
        role: 'user',
        content: dto.message,
      });

      // 2. Setup Server-Sent Events (SSE) streaming
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // 3. Query RAG service for streaming response
      const { stream, sources } = await this.ragService.query(
        dto.message,
        sessionId,
      );

      let fullResponse = '';

      // 4. Stream the response chunks
      stream.subscribe({
        next: (chunk) => {
          fullResponse += chunk;
          // Send chunk as SSE event
          response.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        complete: async () => {
          try {
            // 5. Save assistant message with sources
            await this.chatService.saveMessage({
              sessionId,
              role: 'assistant',
              content: fullResponse,
              sources,
            });

            // 6. Send completion event
            response.write('data: [DONE]\n\n');
            response.end();

            this.logger.log(`Completed streaming response for session ${sessionId}`);
          } catch (error) {
            this.logger.error(
              `Failed to save assistant message: ${error.message}`,
              error.stack,
            );
            response.write(
              `data: ${JSON.stringify({ error: 'Failed to save message' })}\n\n`,
            );
            response.end();
          }
        },
        error: (error) => {
          this.logger.error(
            `Streaming error for session ${sessionId}: ${error.message}`,
            error.stack,
          );
          response.write(
            `data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`,
          );
          response.end();
        },
      });
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error.message || 'Failed to process message',
      });
    }
  }
}
