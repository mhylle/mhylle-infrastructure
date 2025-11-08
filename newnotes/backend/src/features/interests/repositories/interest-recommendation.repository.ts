import { Injectable } from '@nestjs/common';
import { DataSource, Repository, LessThan, MoreThan } from 'typeorm';
import { InterestRecommendation } from '../entities/interest-recommendation.entity';

@Injectable()
export class InterestRecommendationRepository extends Repository<InterestRecommendation> {
  constructor(private dataSource: DataSource) {
    super(InterestRecommendation, dataSource.createEntityManager());
  }

  async findBySourceInterest(sourceInterestId: string): Promise<InterestRecommendation[]> {
    return this.find({
      where: {
        sourceInterestId,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        recommendationScore: 'DESC',
      },
    });
  }

  async findTopRecommendations(
    sourceInterestId: string,
    limit: number = 10,
  ): Promise<InterestRecommendation[]> {
    return this.find({
      where: {
        sourceInterestId,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        recommendationScore: 'DESC',
      },
      take: limit,
    });
  }

  async createRecommendation(
    sourceInterestId: string,
    recommendedTopic: string,
    recommendationScore: number,
    reasoning?: string,
    scores?: {
      coOccurrenceScore?: number;
      semanticScore?: number;
      hierarchyScore?: number;
      temporalScore?: number;
    },
  ): Promise<InterestRecommendation> {
    const existing = await this.findOne({
      where: { sourceInterestId, recommendedTopic },
    });

    if (existing) {
      existing.recommendationScore = recommendationScore;
      existing.reasoning = reasoning || existing.reasoning;
      if (scores) {
        existing.coOccurrenceScore = scores.coOccurrenceScore ?? existing.coOccurrenceScore;
        existing.semanticScore = scores.semanticScore ?? existing.semanticScore;
        existing.hierarchyScore = scores.hierarchyScore ?? existing.hierarchyScore;
        existing.temporalScore = scores.temporalScore ?? existing.temporalScore;
      }
      // Extend expiry by 30 days
      existing.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return this.save(existing);
    }

    const recommendation = this.create({
      sourceInterestId,
      recommendedTopic,
      recommendationScore,
      reasoning,
      coOccurrenceScore: scores?.coOccurrenceScore ?? 0,
      semanticScore: scores?.semanticScore ?? 0,
      hierarchyScore: scores?.hierarchyScore ?? 0,
      temporalScore: scores?.temporalScore ?? 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return this.save(recommendation);
  }

  async deleteExpiredRecommendations(): Promise<number> {
    const result = await this.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }
}
