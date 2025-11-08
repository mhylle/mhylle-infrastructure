/**
 * Breakdown of recommendation signal scores
 * Shows individual contribution of each signal type to the overall recommendation score
 */
export interface SignalBreakdown {
  /** Score from interest co-occurrence patterns (0-1) */
  coOccurrence: number;

  /** Score from semantic similarity between topics (0-1) */
  semanticSimilarity: number;

  /** Score from hierarchical relationships (0-1) */
  hierarchy: number;

  /** Score from temporal patterns and trends (0-1) */
  temporal: number;
}

/**
 * Single interest recommendation with scoring details
 * Represents a recommended interest based on multi-signal analysis
 */
export interface InterestRecommendation {
  /** Unique identifier of the recommended interest */
  interestId: string;

  /** Topic name of the recommended interest */
  topic: string;

  /** Overall recommendation score (0-1, weighted combination of signals) */
  score: number;

  /** Detailed breakdown of signal contributions */
  signals: SignalBreakdown;

  /** Human-readable explanation of why this interest is recommended */
  reasoning: string;
}

/**
 * Complete recommendations response from the API
 * Contains recommendations for a source interest with metadata
 */
export interface RecommendationsResponse {
  /** ID of the source interest for which recommendations were generated */
  sourceInterestId: string;

  /** Topic name of the source interest */
  sourceTopic: string;

  /** List of recommended interests, sorted by score descending */
  recommendations: InterestRecommendation[];

  /** Total number of recommendations returned */
  totalCount: number;

  /** Whether this response was served from cache */
  cacheHit: boolean;
}
