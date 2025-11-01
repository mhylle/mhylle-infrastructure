import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RelationshipsMigrationService implements OnModuleInit {
  private readonly logger = new Logger(RelationshipsMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.runMigrations();
  }

  private async runMigrations() {
    this.logger.log('Starting relationships database migrations...');

    try {
      await this.createRelationshipsTable();
      await this.createIndexes();
      this.logger.log('Relationships migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  private async createRelationshipsTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'note_relationships'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table note_relationships already exists, skipping creation');
      return;
    }

    this.logger.log('Creating note_relationships table...');

    await this.dataSource.query(`
      CREATE TABLE note_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        target_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('semantic', 'referential', 'causal', 'temporal')),
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_relationship UNIQUE(source_note_id, target_note_id, relationship_type)
      );
    `);

    this.logger.log('Table note_relationships created successfully');
  }

  private async createIndexes() {
    this.logger.log('Creating indexes for note_relationships...');

    const indexes = [
      {
        name: 'idx_relationships_source',
        query: 'CREATE INDEX IF NOT EXISTS idx_relationships_source ON note_relationships(source_note_id);',
      },
      {
        name: 'idx_relationships_target',
        query: 'CREATE INDEX IF NOT EXISTS idx_relationships_target ON note_relationships(target_note_id);',
      },
      {
        name: 'idx_relationships_confidence',
        query: 'CREATE INDEX IF NOT EXISTS idx_relationships_confidence ON note_relationships(confidence);',
      },
      {
        name: 'idx_relationships_type',
        query: 'CREATE INDEX IF NOT EXISTS idx_relationships_type ON note_relationships(relationship_type);',
      },
    ];

    for (const index of indexes) {
      try {
        await this.dataSource.query(index.query);
        this.logger.log(`Index ${index.name} created successfully`);
      } catch (error) {
        this.logger.warn(`Index ${index.name} may already exist or failed:`, error.message);
      }
    }
  }
}
