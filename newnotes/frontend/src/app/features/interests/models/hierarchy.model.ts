/**
 * Single node in the interest hierarchy tree
 * Represents an interest with its hierarchical metadata and children
 */
export interface HierarchyNode {
  /** Unique identifier of the interest */
  id: string;

  /** Topic name of the interest */
  topic: string;

  /** Confidence score for this hierarchical relationship (0-1) */
  confidence: number;

  /** Number of pieces of evidence supporting this relationship */
  evidenceCount: number;

  /** Depth of this node in the hierarchy tree (0 = root) */
  depth: number;

  /** Child nodes in the hierarchy (more specific interests) */
  children: HierarchyNode[];
}

/**
 * Complete hierarchy response from the API
 * Contains the full interest hierarchy tree with metadata
 */
export interface HierarchyResponse {
  /** Root-level interests (top of the hierarchy) */
  roots: HierarchyNode[];

  /** Total number of interests in the hierarchy */
  totalInterests: number;

  /** Total number of levels in the hierarchy tree */
  totalLevels: number;
}

