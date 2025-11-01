import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage, MessageSource } from '../entities/chat-message.entity';

export interface SaveMessageDto {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepository: Repository<ChatMessage>,
  ) {}

  async createSession(title?: string): Promise<ChatSession> {
    const session = this.sessionRepository.create({
      title: title || 'New Chat',
    });
    return this.sessionRepository.save(session);
  }

  async findAllSessions(): Promise<ChatSession[]> {
    return this.sessionRepository.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findSessionById(id: string): Promise<ChatSession> {
    const session = await this.sessionRepository.findOne({
      where: { id },
      relations: ['messages'],
      order: {
        messages: {
          createdAt: 'ASC',
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with ID ${id} not found`);
    }

    return session;
  }

  async deleteSession(id: string): Promise<void> {
    const result = await this.sessionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Chat session with ID ${id} not found`);
    }
  }

  async saveMessage(dto: SaveMessageDto): Promise<ChatMessage> {
    // Verify session exists
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId },
    });

    if (!session) {
      throw new NotFoundException(
        `Chat session with ID ${dto.sessionId} not found`,
      );
    }

    const message = this.messageRepository.create({
      sessionId: dto.sessionId,
      role: dto.role,
      content: dto.content,
      sources: dto.sources || null,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Update session's updatedAt timestamp
    await this.sessionRepository.update(dto.sessionId, {
      updatedAt: new Date(),
    });

    return savedMessage;
  }

  async getHistory(sessionId: string, limit: number = 10): Promise<ChatMessage[]> {
    return this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
