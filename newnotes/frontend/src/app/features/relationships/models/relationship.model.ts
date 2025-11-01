import { Note } from '../../../core/models/note.model';

export type RelationshipType = 'semantic' | 'referential' | 'causal' | 'temporal';

export interface NoteRelationship {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  relationshipType: RelationshipType;
  confidence: number;
  metadata?: {
    algorithm?: string;
    model?: string;
    detectedAt?: string;
    manual?: boolean;
    backlink?: boolean;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface RelatedNote extends Note {
  relationship: {
    id: string;
    type: RelationshipType;
    confidence: number;
    metadata?: Record<string, any>;
  };
}

export interface RelationshipGroup {
  type: RelationshipType;
  relations: RelatedNote[];
}

export interface RelationshipStats {
  total: number;
  byType: Record<string, number>;
  averageConfidence: number;
}
