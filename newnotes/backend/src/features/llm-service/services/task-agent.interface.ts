export interface ExtractedTask {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  confidence: number;
}

export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  processingTimeMs: number;
  modelUsed: string;
}

export interface ITaskAgentService {
  extractTasksFromNote(noteContent: string): Promise<TaskExtractionResult>;
  extractTasksFromNoteWithRetry(
    noteContent: string,
    maxRetries?: number,
  ): Promise<TaskExtractionResult>;
}
