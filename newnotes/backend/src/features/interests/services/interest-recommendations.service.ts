import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestSimilarity } from '../entities/interest-similarity.entity';
import { InterestHierarchy } from '../entities/interest-hierarchy.entity';
import { InterestRecommendationRepository } from '../repositories/interest-recommendation.repository';
import { InterestHierarchyService } from './interest-hierarchy.service';
import { InterestSimilarityService } from './interest-similarity.service';
import { RedisService } from '@core/redis/redis.service';
import {
  InterestRecommendationDto,
  SignalBreakdownDto,
  RecommendationsResponseDto,
} from '../dto/interest-recommendation.dto';

interface RecommendationCandidate {
  interest: UserInterest;
  scores: {
    coOccurrence: number;
    semantic: number;
    hierarchy: number;
    temporal: number;
    combined: number;
  };
  reasoning: string[];
}

@Injectable()
export class InterestRecommendationsService {
  private readonly logger = new Logger(InterestRecommendationsService.name);

  // Configurable weights for multi-signal scoring
  private readonly WEIGHTS = {
    coOccurrence: 0.35,
    semantic: 0.30,
    hierarchy: 0.20,
    temporal: 0.15,
  };

  // Thresholds
  private readonly SEMANTIC_SIMILARITY_THRESHOLD = 0.6;
  private readonly MIN_RECOMMENDATION_SCORE = 0.3;
  private readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  constructor(
    @InjectRepository(UserInterest)
    private readonly interestRepository: Repository<UserInterest>,
    @InjectRepository(InterestSimilarity)
    private readonly similarityRepository: Repository<InterestSimilarity>,
    @InjectRepository(InterestHierarchy)
    private readonly hierarchyRepository: Repository<InterestHierarchy>,
    private readonly recommendationRepository: InterestRecommendationRepository,
    private readonly hierarchyService: InterestHierarchyService,
    private readonly similarityService: InterestSimilarityService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Generate comprehensive recommendations for a given interest
   */
  async generateRecommendations(
    sourceInterestId: string,
    limit: number = 10,
    minScore: number = this.MIN_RECOMMENDATION_SCORE,
  ): Promise<RecommendationsResponseDto> {
    this.logger.log(`Generating recommendations for interest: ${sourceInterestId}`);

    // Check cache first
    const cacheKey = `interest:recommendations:${sourceInterestId}:${limit}:${minScore}`;
    const cached = await this.getCachedRecommendations(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached recommendations');
      return { ...cached, cacheHit: true };
    }

    // Get source interest
    const sourceInterest = await this.interestRepository.findOne({
      where: { id: sourceInterestId, isActive: true },
    });

    if (!sourceInterest) {
      throw new Error('Source interest not found or inactive');
    }

    // Collect candidates from multiple signals
    const candidates = await this.collectRecommendationCandidates(sourceInterestId);

    // Score and rank candidates
    const scoredCandidates = await this.scoreAndRankCandidates(
      sourceInterest,
      candidates,
      minScore,
    );

    // Take top N recommendations
    const topRecommendations = scoredCandidates.slice(0, limit);

    // Store recommendations in database for future reference
    await this.persistRecommendations(sourceInterestId, topRecommendations);

    // Build response
    const response: RecommendationsResponseDto = {
      sourceInterestId,
      sourceTopic: sourceInterest.topic,
      recommendations: topRecommendations.map((candidate) => this.toDto(candidate)),
      totalCount: scoredCandidates.length,
      cacheHit: false,
    };

    // Cache the response
    await this.cacheRecommendations(cacheKey, response);

    return response;
  }

  /**
   * Collect recommendation candidates from all signal sources
   */
  private async collectRecommendationCandidates(
    sourceInterestId: string,
  ): Promise<Map<string, RecommendationCandidate>> {
    const candidatesMap = new Map<string, RecommendationCandidate>();

    // 1. Co-occurrence Analysis (from InterestRelationship - placeholder for now)
    // Note: InterestRelationship entity doesn't exist yet, so we'll use evidence count as proxy
    await this.addCoOccurrenceCandidates(sourceInterestId, candidatesMap);

    // 2. Semantic Similarity
    await this.addSemanticSimilarityCandidates(sourceInterestId, candidatesMap);

    // 3. Hierarchy Relationships
    await this.addHierarchyCandidates(sourceInterestId, candidatesMap);

    // 4. Temporal Patterns (recently active interests)
    await this.addTemporalCandidates(sourceInterestId, candidatesMap);

    return candidatesMap;
  }

  /**
   * Add candidates based on co-occurrence patterns
   */
  private async addCoOccurrenceCandidates(
    sourceInterestId: string,
    candidatesMap: Map<string, RecommendationCandidate>,
  ): Promise<void> {
    // For now, use interests with similar evidence count as proxy for co-occurrence
    // In a full implementation, this would query InterestRelationship table
    const sourceInterest = await this.interestRepository.findOne({
      where: { id: sourceInterestId },
    });

    if (!sourceInterest) return;

    const relatedInterests = await this.interestRepository
      .createQueryBuilder('interest')
      .where('interest.isActive = :active', { active: true })
      .andWhere('interest.id != :sourceId', { sourceId: sourceInterestId })
      .orderBy('ABS(interest.evidenceCount - :evidenceCount)', 'ASC')
      .setParameter('evidenceCount', sourceInterest.evidenceCount)
      .limit(20)
      .getMany();

    for (const interest of relatedInterests) {
      const evidenceDiff = Math.abs(interest.evidenceCount - sourceInterest.evidenceCount);
      const maxEvidence = Math.max(interest.evidenceCount, sourceInterest.evidenceCount, 1);
      const score = 1 - evidenceDiff / maxEvidence;

      this.addOrUpdateCandidate(candidatesMap, interest, {
        coOccurrence: score,
        reason: `Similar evidence patterns (${interest.evidenceCount} vs ${sourceInterest.evidenceCount})`,
      });
    }
  }

  /**
   * Add candidates based on semantic similarity
   */
  private async addSemanticSimilarityCandidates(
    sourceInterestId: string,
    candidatesMap: Map<string, RecommendationCandidate>,
  ): Promise<void> {
    const similarInterests = await this.similarityService.findSimilarInterests(
      sourceInterestId,
      this.SEMANTIC_SIMILARITY_THRESHOLD,
    );

    for (const { interest, similarity } of similarInterests) {
      this.addOrUpdateCandidate(candidatesMap, interest, {
        semantic: similarity,
        reason: `High semantic similarity (${(similarity * 100).toFixed(1)}%)`,
      });
    }
  }

  /**
   * Add candidates based on hierarchy relationships
   */
  private async addHierarchyCandidates(
    sourceInterestId: string,
    candidatesMap: Map<string, RecommendationCandidate>,
  ): Promise<void> {
    // Get parents (broader topics)
    const parents = await this.hierarchyService.getAncestors(sourceInterestId);
    for (const parent of parents) {
      this.addOrUpdateCandidate(candidatesMap, parent, {
        hierarchy: 0.9,
        reason: `Broader topic category`,
      });
    }

    // Get children (more specific topics)
    const children = await this.hierarchyService.getDescendants(sourceInterestId);
    for (const child of children) {
      this.addOrUpdateCandidate(candidatesMap, child, {
        hierarchy: 0.85,
        reason: `More specific subtopic`,
      });
    }

    // Get siblings (same parent)
    const siblings = await this.getSiblingInterests(sourceInterestId);
    for (const sibling of siblings) {
      this.addOrUpdateCandidate(candidatesMap, sibling, {
        hierarchy: 0.75,
        reason: `Related topic (same category)`,
      });
    }
  }

  /**
   * Add candidates based on temporal patterns
   */
  private async addTemporalCandidates(
    sourceInterestId: string,
    candidatesMap: Map<string, RecommendationCandidate>,
  ): Promise<void> {
    const sourceInterest = await this.interestRepository.findOne({
      where: { id: sourceInterestId },
    });

    if (!sourceInterest) return;

    // Get recently active interests (within last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentInterests = await this.interestRepository
      .createQueryBuilder('interest')
      .where('interest.isActive = :active', { active: true })
      .andWhere('interest.id != :sourceId', { sourceId: sourceInterestId })
      .andWhere('interest.lastSeen >= :thirtyDaysAgo', { thirtyDaysAgo })
      .orderBy('interest.lastSeen', 'DESC')
      .limit(15)
      .getMany();

    const now = Date.now();
    const sourceLastSeen = sourceInterest.lastSeen.getTime();

    for (const interest of recentInterests) {
      const interestLastSeen = interest.lastSeen.getTime();
      const timeDiff = Math.abs(sourceLastSeen - interestLastSeen);
      const maxDiff = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

      // Score higher for interests active around the same time
      const temporalScore = 1 - timeDiff / maxDiff;

      // Boost score if very recent
      const recencyBoost = interest.lastSeen.getTime() > now - 7 * 24 * 60 * 60 * 1000 ? 0.2 : 0;

      this.addOrUpdateCandidate(candidatesMap, interest, {
        temporal: Math.min(temporalScore + recencyBoost, 1.0),
        reason: `Recently active (${this.formatRelativeTime(interest.lastSeen)})`,
      });
    }
  }

  /**
   * Get sibling interests (interests sharing the same parent)
   */
  private async getSiblingInterests(interestId: string): Promise<UserInterest[]> {
    const parents = await this.hierarchyService.getAncestors(interestId);

    const siblings: UserInterest[] = [];
    for (const parent of parents) {
      const children = await this.hierarchyService.getDescendants(parent.id);
      siblings.push(...children.filter((child) => child.id !== interestId));
    }

    // Deduplicate
    const uniqueSiblings = Array.from(
      new Map(siblings.map((s) => [s.id, s])).values(),
    );

    return uniqueSiblings;
  }

  /**
   * Add or update a candidate in the map
   */
  private addOrUpdateCandidate(
    candidatesMap: Map<string, RecommendationCandidate>,
    interest: UserInterest,
    update: { coOccurrence?: number; semantic?: number; hierarchy?: number; temporal?: number; reason: string },
  ): void {
    const existing = candidatesMap.get(interest.id);

    if (existing) {
      // Update existing candidate
      if (update.coOccurrence !== undefined) {
        existing.scores.coOccurrence = Math.max(existing.scores.coOccurrence, update.coOccurrence);
      }
      if (update.semantic !== undefined) {
        existing.scores.semantic = Math.max(existing.scores.semantic, update.semantic);
      }
      if (update.hierarchy !== undefined) {
        existing.scores.hierarchy = Math.max(existing.scores.hierarchy, update.hierarchy);
      }
      if (update.temporal !== undefined) {
        existing.scores.temporal = Math.max(existing.scores.temporal, update.temporal);
      }
      existing.reasoning.push(update.reason);
    } else {
      // Create new candidate
      candidatesMap.set(interest.id, {
        interest,
        scores: {
          coOccurrence: update.coOccurrence || 0,
          semantic: update.semantic || 0,
          hierarchy: update.hierarchy || 0,
          temporal: update.temporal || 0,
          combined: 0, // Will be calculated later
        },
        reasoning: [update.reason],
      });
    }
  }

  /**
   * Score and rank all candidates using multi-signal approach
   */
  private async scoreAndRankCandidates(
    sourceInterest: UserInterest,
    candidatesMap: Map<string, RecommendationCandidate>,
    minScore: number,
  ): Promise<RecommendationCandidate[]> {
    const candidates = Array.from(candidatesMap.values());

    // Calculate combined scores
    for (const candidate of candidates) {
      candidate.scores.combined =
        candidate.scores.coOccurrence * this.WEIGHTS.coOccurrence +
        candidate.scores.semantic * this.WEIGHTS.semantic +
        candidate.scores.hierarchy * this.WEIGHTS.hierarchy +
        candidate.scores.temporal * this.WEIGHTS.temporal;
    }

    // Filter by minimum score and sort by combined score
    return candidates
      .filter((c) => c.scores.combined >= minScore)
      .sort((a, b) => b.scores.combined - a.scores.combined);
  }

  /**
   * Persist recommendations to database
   */
  private async persistRecommendations(
    sourceInterestId: string,
    recommendations: RecommendationCandidate[],
  ): Promise<void> {
    for (const rec of recommendations) {
      await this.recommendationRepository.createRecommendation(
        sourceInterestId,
        rec.interest.topic,
        rec.scores.combined,
        rec.reasoning.join(' • '),
        {
          coOccurrenceScore: rec.scores.coOccurrence,
          semanticScore: rec.scores.semantic,
          hierarchyScore: rec.scores.hierarchy,
          temporalScore: rec.scores.temporal,
        },
      );
    }
  }

  /**
   * Convert candidate to DTO
   */
  private toDto(candidate: RecommendationCandidate): InterestRecommendationDto {
    return {
      interestId: candidate.interest.id,
      topic: candidate.interest.topic,
      score: candidate.scores.combined,
      signals: {
        coOccurrence: candidate.scores.coOccurrence,
        semanticSimilarity: candidate.scores.semantic,
        hierarchy: candidate.scores.hierarchy,
        temporal: candidate.scores.temporal,
      },
      reasoning: candidate.reasoning.join(' • '),
    };
  }

  /**
   * Get cached recommendations
   */
  private async getCachedRecommendations(
    cacheKey: string,
  ): Promise<RecommendationsResponseDto | null> {
    try {
      const cached = await this.redisService['client'].get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn(`Cache read failed: ${error.message}`);
    }
    return null;
  }

  /**
   * Cache recommendations
   */
  private async cacheRecommendations(
    cacheKey: string,
    response: RecommendationsResponseDto,
  ): Promise<void> {
    try {
      await this.redisService['client'].setex(
        cacheKey,
        this.CACHE_TTL_SECONDS,
        JSON.stringify(response),
      );
      this.logger.debug(`Cached recommendations with TTL ${this.CACHE_TTL_SECONDS}s`);
    } catch (error) {
      this.logger.warn(`Cache write failed: ${error.message}`);
    }
  }

  /**
   * Format relative time for display
   */
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  /**
   * Invalidate cache for a specific interest
   */
  async invalidateCache(interestId: string): Promise<void> {
    try {
      const pattern = `interest:recommendations:${interestId}:*`;
      const keys = await this.redisService['client'].keys(pattern);

      if (keys.length > 0) {
        await this.redisService['client'].del(...keys);
        this.logger.log(`Invalidated ${keys.length} cache entries for interest ${interestId}`);
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error.message}`);
    }
  }
}
