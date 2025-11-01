export interface ChatSession {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: MessageSource[];
  createdAt: Date;
}

export interface MessageSource {
  noteId: string;
  title: string;
  relevanceScore: number;
}
