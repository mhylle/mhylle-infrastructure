export interface Interest {
  id: string;
  topic: string;
  confidence: number;
  sourceType: string;
  evidenceCount: number;
  lastSeen: Date;
  createdAt: Date;
}
