import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InterestSimilarity } from '../entities/interest-similarity.entity';

@Injectable()
export class InterestSimilarityRepository extends Repository<InterestSimilarity> {
  constructor(private dataSource: DataSource) {
    super(InterestSimilarity, dataSource.createEntityManager());
  }

  async findSimilarity(
    interest1Id: string,
    interest2Id: string,
  ): Promise<InterestSimilarity | null> {
    // Ensure interest1Id < interest2Id for consistent lookup (per CHECK constraint)
    const [id1, id2] = [interest1Id, interest2Id].sort();

    return this.findOne({
      where: {
        interest1Id: id1,
        interest2Id: id2,
      },
    });
  }

  async saveSimilarity(
    interest1Id: string,
    interest2Id: string,
    similarityScore: number,
  ): Promise<InterestSimilarity> {
    // Ensure interest1Id < interest2Id for consistent storage (per CHECK constraint)
    const [id1, id2] = [interest1Id, interest2Id].sort();

    const existing = await this.findSimilarity(id1, id2);

    if (existing) {
      existing.similarityScore = similarityScore;
      return this.save(existing);
    }

    const similarity = this.create({
      interest1Id: id1,
      interest2Id: id2,
      similarityScore,
    });

    return this.save(similarity);
  }

  async findSimilarInterests(
    interestId: string,
    threshold: number = 0.85,
  ): Promise<Array<{ interestId: string; similarity: number }>> {
    const results = await this.query(`
      SELECT
        CASE
          WHEN interest_1_id = $1 THEN interest_2_id
          ELSE interest_1_id
        END as "interestId",
        similarity_score as similarity
      FROM interest_similarities
      WHERE (interest_1_id = $1 OR interest_2_id = $1)
        AND similarity_score >= $2
      ORDER BY similarity_score DESC
    `, [interestId, threshold]);

    return results;
  }
}
