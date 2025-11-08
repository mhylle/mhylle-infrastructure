/**
 * Barrel export for all interest-related model interfaces
 * Enables clean imports: import { InterestRecommendation, HierarchyNode } from './models';
 */

// Core interest models
export * from './interest.model';
export * from './subscription.model';

// Recommendation models (Phase 8)
export * from './recommendation.model';

// Hierarchy and path models (Phase 8)
export * from './hierarchy.model';
export * from './path.model';

// Legacy models (may be deprecated in favor of recommendation.model.ts)
export * from './interest-recommendation.model';
