import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserInterest } from '../entities/user-interest.entity';
import { InterestEmbedding } from '../entities/interest-embedding.entity';
import { InterestSimilarity } from '../entities/interest-similarity.entity';
import { InterestEvidence } from '../entities/interest-evidence.entity';
import { EmbeddingsService } from '@features/embeddings/services/embeddings.service';
import { InterestEmbeddingRepository } from '../repositories/interest-embedding.repository';
import { InterestSimilarityRepository } from '../repositories/interest-similarity.repository';

export interface MergeResult {
  primaryInterest: UserInterest;
  mergedInterests: UserInterest[];
  totalEvidenceTransferred: number;
}

@Injectable()
export class InterestSimilarityService {
  private readonly logger = new Logger(InterestSimilarityService.name);
  private readonly SIMILARITY_THRESHOLD = 0.85;

  constructor(
    @InjectRepository(UserInterest)
    private readonly interestRepository: Repository<UserInterest>,
    @InjectRepository(InterestEvidence)
    private readonly evidenceRepository: Repository<InterestEvidence>,
    private readonly interestEmbeddingRepository: InterestEmbeddingRepository,
    private readonly interestSimilarityRepository: InterestSimilarityRepository,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  /**
   * Generate and store embedding for an interest
   */
  async generateInterestEmbedding(interest: UserInterest): Promise<InterestEmbedding> {
    this.logger.log(`Generating embedding for interest: ${interest.topic}`);

    const existingEmbedding = await this.interestEmbeddingRepository.findByInterestId(interest.id);
    if (existingEmbedding) {
      this.logger.debug(`Embedding already exists for interest: ${interest.topic}`);
      return existingEmbedding;
    }

    const embedding = await this.embeddingsService.generateEmbedding(interest.topic);

    const interestEmbedding = this.interestEmbeddingRepository.create({
      interestId: interest.id,
      embedding,
      modelVersion: 'qwen3-embedding-8b',
    });

    return this.interestEmbeddingRepository.save(interestEmbedding);
  }

  /**
   * Compute similarity score between two interests
   */
  async computeSimilarity(interest1Id: string, interest2Id: string): Promise<number> {
    // Check if already computed
    const existing = await this.interestSimilarityRepository.findSimilarity(interest1Id, interest2Id);
    if (existing) {
      return existing.similarityScore;
    }

    // Get embeddings
    const embedding1 = await this.interestEmbeddingRepository.findByInterestId(interest1Id);
    const embedding2 = await this.interestEmbeddingRepository.findByInterestId(interest2Id);

    if (!embedding1 || !embedding2) {
      throw new Error('Embeddings not found for one or both interests');
    }

    // Compute cosine similarity
    const similarity = this.cosineSimilarity(embedding1.embedding, embedding2.embedding);

    // Store for future use
    await this.interestSimilarityRepository.saveSimilarity(interest1Id, interest2Id, similarity);

    return similarity;
  }

  /**
   * Find all interests similar to the given interest
   */
  async findSimilarInterests(
    interestId: string,
    threshold: number = this.SIMILARITY_THRESHOLD,
  ): Promise<Array<{ interest: UserInterest; similarity: number }>> {
    const embedding = await this.interestEmbeddingRepository.findByInterestId(interestId);
    if (!embedding) {
      return [];
    }

    const similarEmbeddings = await this.interestEmbeddingRepository.findSimilarInterests(
      embedding.embedding,
      threshold,
      20,
    );

    const results = [];
    for (const similar of similarEmbeddings) {
      if (similar.interestId === interestId) continue;

      const interest = await this.interestRepository.findOne({
        where: { id: similar.interestId, isActive: true },
      });

      if (interest) {
        results.push({
          interest,
          similarity: similar.similarity,
        });
      }
    }

    return results;
  }

  /**
   * Merge similar interests into a single primary interest
   */
  async mergeSimilarInterests(primaryInterestId: string, secondaryInterestIds: string[]): Promise<MergeResult> {
    this.logger.log(`Merging ${secondaryInterestIds.length} interests into ${primaryInterestId}`);

    const primaryInterest = await this.interestRepository.findOne({
      where: { id: primaryInterestId },
    });

    if (!primaryInterest) {
      throw new Error('Primary interest not found');
    }

    const mergedInterests: UserInterest[] = [];
    let totalEvidenceTransferred = 0;

    for (const secondaryId of secondaryInterestIds) {
      const secondary = await this.interestRepository.findOne({
        where: { id: secondaryId },
      });

      if (!secondary || !secondary.isActive) {
        continue;
      }

      // Transfer evidence
      const evidenceCount = await this.evidenceRepository.update(
        { interestId: secondaryId },
        { interestId: primaryInterestId },
      );
      totalEvidenceTransferred += evidenceCount.affected || 0;

      // Add secondary topic to synonyms
      primaryInterest.synonyms = [
        ...new Set([...primaryInterest.synonyms, secondary.topic, ...secondary.synonyms]),
      ];

      // Update confidence (take max)
      primaryInterest.confidence = Math.max(primaryInterest.confidence, secondary.confidence);

      // Update evidence count
      primaryInterest.evidenceCount += secondary.evidenceCount;

      // Mark secondary as merged
      secondary.isActive = false;
      secondary.mergedIntoId = primaryInterestId;
      await this.interestRepository.save(secondary);

      mergedInterests.push(secondary);
    }

    // Save updated primary interest
    await this.interestRepository.save(primaryInterest);

    this.logger.log(
      `Merge complete: ${mergedInterests.length} interests merged, ${totalEvidenceTransferred} evidence transferred`,
    );

    return {
      primaryInterest,
      mergedInterests,
      totalEvidenceTransferred,
    };
  }

  /**
   * Auto-detect and merge similar interests across all active interests
   */
  async autoMergeSimilarInterests(threshold: number = this.SIMILARITY_THRESHOLD): Promise<MergeResult[]> {
    this.logger.log('Starting auto-merge process...');

    const activeInterests = await this.interestRepository.find({
      where: { isActive: true },
    });

    // Ensure all interests have embeddings
    for (const interest of activeInterests) {
      await this.generateInterestEmbedding(interest);
    }

    // Find similar interest groups
    const mergeGroups = await this.findMergeGroups(activeInterests, threshold);

    // Execute merges
    const results: MergeResult[] = [];
    for (const group of mergeGroups) {
      const [primary, ...secondaries] = group;
      const result = await this.mergeSimilarInterests(
        primary.id,
        secondaries.map((i) => i.id),
      );
      results.push(result);
    }

    this.logger.log(`Auto-merge complete: ${results.length} merge operations performed`);
    return results;
  }

  /**
   * Find groups of similar interests that should be merged
   */
  private async findMergeGroups(
    interests: UserInterest[],
    threshold: number,
  ): Promise<UserInterest[][]> {
    const groups: UserInterest[][] = [];
    const processed = new Set<string>();

    for (const interest of interests) {
      if (processed.has(interest.id)) continue;

      const similarInterests = await this.findSimilarInterests(interest.id, threshold);

      if (similarInterests.length === 0) {
        processed.add(interest.id);
        continue;
      }

      // Create group with interest + similar interests
      const group = [interest, ...similarInterests.map((s) => s.interest)];

      // Mark all as processed
      group.forEach((i) => processed.add(i.id));

      groups.push(group);
    }

    return groups;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }
}
