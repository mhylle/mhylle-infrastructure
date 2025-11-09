export type IntentType =
  | 'task_creation'
  | 'task_query'
  | 'information_seeking'
  | 'information_seeking_web'
  | 'information_seeking_notes'
  | 'analytical'
  | 'conversational';

export interface IntentClassification {
  intent: IntentType;
  confidence: number; // 0.0-1.0
  reasoning?: string;
  requires_clarification: boolean;
  clarification_questions?: string[];
  suggested_search_scope?: 'notes' | 'web' | 'both';
}

export interface RoutingRule {
  intent: IntentType;
  confidence: number;
  patterns: {
    keywords?: string[];
    regex?: RegExp[];
    negativeKeywords?: string[];
  };
  priority: number;
  examples: string[];
}
