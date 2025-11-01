import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatSession } from './chat-session.entity';

export interface MessageSource {
  noteId: string;
  title: string;
  relevanceScore: number;
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatSession, (session) => session.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant';

  @Column('text')
  content: string;

  @Column('jsonb', { nullable: true })
  sources: MessageSource[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
