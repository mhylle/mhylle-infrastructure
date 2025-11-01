import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class EmbeddingsMigrationService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsMigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Running embeddings database migrations...');
    await this.ensurePgvectorExtension();
    await this.ensureEmbeddingsTableExists();
    await this.ensureIvfflatIndex();
    this.logger.log('Embeddings database migrations complete');
  }

  private async ensurePgvectorExtension(): Promise<void> {
    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS vector');
      this.logger.log('pgvector extension enabled');
    } catch (error) {
      this.logger.error(
        `Failed to create pgvector extension: ${error.message}`,
      );
      throw error;
    }
  }

  private async ensureEmbeddingsTableExists(): Promise<void> {
    try {
      const tableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'note_embeddings'
        )
      `);

      if (!tableExists[0].exists) {
        this.logger.log('Creating note_embeddings table...');
        await this.dataSource.query(`
          CREATE TABLE note_embeddings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "noteId" UUID NOT NULL,
            embedding vector(384) NOT NULL,
            model VARCHAR(100) NOT NULL,
            "createdAt" TIMESTAMP DEFAULT NOW(),
            CONSTRAINT "FK_note_embeddings_note" FOREIGN KEY ("noteId")
              REFERENCES notes(id) ON DELETE CASCADE,
            CONSTRAINT "UQ_note_embeddings_noteId_model" UNIQUE ("noteId", model)
          )
        `);
        this.logger.log('note_embeddings table created');
      } else {
        this.logger.log('note_embeddings table already exists');
      }
    } catch (error) {
      this.logger.error(
        `Failed to create note_embeddings table: ${error.message}`,
      );
      throw error;
    }
  }

  private async ensureIvfflatIndex(): Promise<void> {
    try {
      const indexExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'note_embeddings'
          AND indexname = 'idx_note_embeddings_embedding_ivfflat'
        )
      `);

      if (!indexExists[0].exists) {
        this.logger.log('Creating ivfflat index on embeddings...');

        // Check if we have enough rows for ivfflat (needs at least lists)
        const count = await this.dataSource.query(
          'SELECT COUNT(*) FROM note_embeddings',
        );
        const rowCount = parseInt(count[0].count);

        if (rowCount > 0) {
          // Create ivfflat index with appropriate number of lists
          const lists = Math.max(Math.floor(rowCount / 1000), 10);
          await this.dataSource.query(`
            CREATE INDEX idx_note_embeddings_embedding_ivfflat
            ON note_embeddings
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = ${lists})
          `);
          this.logger.log(
            `ivfflat index created with ${lists} lists`,
          );
        } else {
          this.logger.log(
            'Skipping ivfflat index creation - no embeddings yet (will auto-create on first embedding)',
          );
          // Create a simple index for now
          await this.dataSource.query(`
            CREATE INDEX IF NOT EXISTS idx_note_embeddings_noteId
            ON note_embeddings ("noteId")
          `);
        }
      } else {
        this.logger.log('ivfflat index already exists');
      }
    } catch (error) {
      this.logger.error(
        `Failed to create ivfflat index: ${error.message}`,
      );
      // Don't throw - index creation is not critical for basic functionality
    }
  }
}
