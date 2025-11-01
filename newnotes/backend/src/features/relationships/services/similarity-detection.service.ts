import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Note } from '@shared/entities/note.entity';
import { NoteEmbedding } from '@features/embeddings/entities/note-embedding.entity';
import { RelationshipsService } from './relationships.service';

interface SimilarNote {
  id: string;
  similarity: number;
}

@Injectable()
export class SimilarityDetectionService {
  private readonly logger = new Logger(SimilarityDetectionService.name);

  constructor(
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
    @InjectRepository(NoteEmbedding)
    private readonly embeddingsRepo: Repository<NoteEmbedding>,
    private readonly relationshipsService: RelationshipsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Run nightly at 2 AM to detect semantic similarities between notes
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledSimilarityDetection() {
    this.logger.log('Starting scheduled similarity detection...');
    await this.detectSimilarities();
  }

  /**
   * Manual trigger for similarity detection
   */
  async detectSimilarities(): Promise<{ processed: number; created: number }> {
    this.logger.log('Detecting similarities between notes...');

    const notes = await this.notesRepo.find();
    let processedCount = 0;
    let createdCount = 0;

    for (const note of notes) {
      try {
        const similarNotes = await this.findSimilarNotes(note.id, 0.7, 10);

        this.logger.log(
          `Found ${similarNotes.length} similar notes for note ${note.id.substring(0, 8)}`,
        );

        for (const match of similarNotes) {
          try {
            // Create bidirectional semantic relationships
            await this.createBidirectionalSemanticRelationship(
              note.id,
              match.id,
              match.similarity,
            );
            createdCount += 2; // Forward + backward
          } catch (error) {
            this.logger.warn(
              `Failed to create relationship between ${note.id} and ${match.id}: ${error.message}`,
            );
          }
        }

        processedCount++;
      } catch (error) {
        this.logger.error(`Failed to process note ${note.id}: ${error.message}`);
      }
    }

    this.logger.log(
      `Similarity detection completed. Processed ${processedCount} notes, created ${createdCount} relationships`,
    );

    return { processed: processedCount, created: createdCount };
  }

  /**
   * Find similar notes using vector similarity (cosine distance)
   */
  private async findSimilarNotes(
    noteId: string,
    minSimilarity: number,
    limit: number,
  ): Promise<SimilarNote[]> {
    try {
      const results = await this.dataSource.query(
        `
        SELECT
          n.id,
          1 - (ne2.embedding <=> ne1.embedding) as similarity
        FROM note_embeddings ne1
        JOIN note_embeddings ne2 ON ne2."noteId" != ne1."noteId"
        JOIN notes n ON n.id = ne2."noteId"
        WHERE ne1."noteId" = $1
          AND 1 - (ne2.embedding <=> ne1.embedding) >= $2
        ORDER BY similarity DESC
        LIMIT $3
        `,
        [noteId, minSimilarity, limit],
      );

      return results.map((r) => ({
        id: r.id,
        similarity: parseFloat(r.similarity),
      }));
    } catch (error) {
      this.logger.error(`Failed to find similar notes for ${noteId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Create bidirectional semantic relationships (forward + backward)
   */
  private async createBidirectionalSemanticRelationship(
    sourceId: string,
    targetId: string,
    similarity: number,
  ): Promise<void> {
    const metadata = {
      algorithm: 'cosine',
      model: 'all-MiniLM-L6-v2',
      detectedAt: new Date().toISOString(),
    };

    // Forward relationship
    await this.relationshipsService.upsert(
      sourceId,
      targetId,
      'semantic',
      similarity,
      metadata,
    );

    // Backward relationship (bidirectional)
    await this.relationshipsService.upsert(
      targetId,
      sourceId,
      'semantic',
      similarity,
      { ...metadata, bidirectional: true },
    );
  }

  /**
   * Find similar notes for a specific note (on-demand)
   */
  async findSimilarNotesForNote(
    noteId: string,
    minSimilarity = 0.7,
    limit = 10,
  ): Promise<SimilarNote[]> {
    return this.findSimilarNotes(noteId, minSimilarity, limit);
  }
}
