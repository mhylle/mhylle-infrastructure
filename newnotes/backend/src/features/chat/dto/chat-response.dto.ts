import { MessageSource } from '../entities/chat-message.entity';

export class ChatMessageResponseDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
  createdAt: Date;
}

export class ChatSessionResponseDto {
  id: string;
  title: string | null;
  messages?: ChatMessageResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
