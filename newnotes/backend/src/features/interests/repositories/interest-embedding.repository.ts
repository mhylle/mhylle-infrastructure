import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InterestEmbedding } from '../entities/interest-embedding.entity';

@Injectable()
export class InterestEmbeddingRepository extends Repository<InterestEmbedding> {
  constructor(private dataSource: DataSource) {
    super(InterestEmbedding, dataSource.createEntityManager());
  }

  async findByInterestId(interestId: string): Promise<InterestEmbedding | null> {
    return this.findOne({ where: { interestId } });
  }

  async findSimilarInterests(
    embedding: number[],
    threshold: number = 0.85,
    limit: number = 10,
  ): Promise<Array<{ interestId: string; similarity: number }>> {
    // Since pgvector index can't handle 4096 dimensions, use brute-force comparison
    // This will be optimized with precomputed similarities in interest_similarities table

    const results = await this.query(`
      SELECT
        interest_id as "interestId",
        1 - (embedding <=> $1::vector) as similarity
      FROM interest_embeddings
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY similarity DESC
      LIMIT $3
    `, [JSON.stringify(embedding), threshold, limit]);

    return results;
  }
}
