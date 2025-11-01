export class RelationshipResponseDto {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  relationshipType: 'semantic' | 'referential' | 'causal' | 'temporal';
  confidence: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class RelatedNoteDto {
  id: string;
  content: string;
  raw_content: string;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
  source: string;
  relationship: {
    id: string;
    type: 'semantic' | 'referential' | 'causal' | 'temporal';
    confidence: number;
    metadata?: Record<string, any>;
  };
}

export class DetectionResultDto {
  message: string;
  processed: number;
  created: number;
}

export class StatsDto {
  total: number;
  byType: Record<string, number>;
  averageConfidence: number;
}
