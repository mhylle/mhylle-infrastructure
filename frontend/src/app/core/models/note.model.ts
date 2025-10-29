export interface Note {
  id: string;
  content: string;
  raw_content: string;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
  source: string;
}

export interface CreateNoteDto {
  content: string;
}
