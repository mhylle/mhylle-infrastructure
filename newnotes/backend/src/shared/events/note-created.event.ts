export class NoteCreatedEvent {
  noteId: string;
  content: string;
  metadata: {
    userId: string;
    createdAt: Date;
    tags?: string[];
  };
  timestamp: Date;

  constructor(partial: Partial<NoteCreatedEvent>) {
    Object.assign(this, partial);
  }
}
