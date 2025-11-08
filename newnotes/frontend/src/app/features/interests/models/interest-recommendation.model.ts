export interface RecommendationSignal {
  coOccurrence: number;
  semanticSimilarity: number;
  hierarchicalRelevance: number;
  temporalCorrelation: number;
}

export interface InterestRecommendation {
  id: string;
  topic: string;
  confidence: number;
  recommendationScore: number;
  signals: RecommendationSignal;
  reasoning: string;
  evidenceCount: number;
  lastSeen: Date;
  createdAt: Date;
}
