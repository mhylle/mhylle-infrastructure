export interface NoteCreatedEvent {
  noteId: string;
  content: string;
  rawContent: string;
  source: string;
  timestamp: string;
}

export const NOTE_EVENTS = {
  NOTE_CREATED: 'note.created',
  NOTE_UPDATED: 'note.updated',
  NOTE_DELETED: 'note.deleted',
} as const;
