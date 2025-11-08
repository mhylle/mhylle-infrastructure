/**
 * Single node in an interest path (ancestors or descendants)
 * Represents an interest with its position in the hierarchy
 */
export interface PathNode {
  /** Unique identifier of the interest */
  id: string;

  /** Topic name of the interest */
  topic: string;

  /** Depth of this node relative to the source interest (0 = source, positive = deeper) */
  depth: number;
}

/**
 * Response containing descendant interests (more specific)
 * Lists all interests that are children, grandchildren, etc. of the source interest
 */
export interface DescendantsResponse {
  /** ID of the source interest */
  sourceInterestId: string;

  /** Topic name of the source interest */
  sourceTopic: string;

  /** List of descendant interests, ordered by depth */
  descendants: PathNode[];

  /** Total number of descendants */
  totalCount: number;
}

/**
 * Response containing ancestor interests (more general)
 * Lists all interests that are parents, grandparents, etc. of the source interest
 */
export interface AncestorsResponse {
  /** ID of the source interest */
  sourceInterestId: string;

  /** Topic name of the source interest */
  sourceTopic: string;

  /** List of ancestor interests, ordered from immediate parent to root */
  ancestors: PathNode[];

  /** Total number of ancestors */
  totalCount: number;
}
