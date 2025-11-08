import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class InterestsMigrationService implements OnModuleInit {
  private readonly logger = new Logger(InterestsMigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.runMigrations();
  }

  private async runMigrations() {
    this.logger.log('Starting interests database migrations...');

    try {
      await this.createUserInterestsTable();
      await this.createInterestEvidenceTable();
      await this.createTopicSubscriptionsTable();
      await this.createNewsItemsTable();
      await this.createUserNewsDigestTable();
      await this.createIndexes();
      this.logger.log('Interests migrations completed successfully');
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  private async createUserInterestsTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_interests'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table user_interests already exists, skipping creation');
      return;
    }

    this.logger.log('Creating user_interests table...');

    await this.dataSource.query(`
      CREATE TABLE user_interests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic VARCHAR(255) NOT NULL,
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        source_type VARCHAR(50) NOT NULL,
        evidence_count INTEGER NOT NULL DEFAULT 1,
        last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_topic UNIQUE(topic)
      );
    `);

    this.logger.log('Table user_interests created successfully');
  }

  private async createInterestEvidenceTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'interest_evidence'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table interest_evidence already exists, skipping creation');
      return;
    }

    this.logger.log('Creating interest_evidence table...');

    await this.dataSource.query(`
      CREATE TABLE interest_evidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        interest_id UUID REFERENCES user_interests(id) ON DELETE CASCADE,
        source_id UUID NOT NULL,
        source_type VARCHAR(50) NOT NULL,
        relevance_score DECIMAL(3,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    this.logger.log('Table interest_evidence created successfully');
  }

  private async createTopicSubscriptionsTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'topic_subscriptions'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table topic_subscriptions already exists, skipping creation');
      return;
    }

    this.logger.log('Creating topic_subscriptions table...');

    await this.dataSource.query(`
      CREATE TABLE topic_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic VARCHAR(255) NOT NULL UNIQUE,
        is_auto_detected BOOLEAN NOT NULL DEFAULT false,
        confirmed BOOLEAN NOT NULL DEFAULT false,
        notification_frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
        last_fetch TIMESTAMP,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    this.logger.log('Table topic_subscriptions created successfully');
  }

  private async createNewsItemsTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'news_items'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table news_items already exists, skipping creation');
      return;
    }

    this.logger.log('Creating news_items table...');

    await this.dataSource.query(`
      CREATE TABLE news_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic VARCHAR(255) NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        url VARCHAR(500) NOT NULL UNIQUE,
        source VARCHAR(255),
        published_at TIMESTAMP NOT NULL,
        relevance_score DECIMAL(3,2) NOT NULL,
        fetched_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    this.logger.log('Table news_items created successfully');
  }

  private async createUserNewsDigestTable() {
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_news_digest'
      );
    `);

    if (tableExists[0].exists) {
      this.logger.log('Table user_news_digest already exists, skipping creation');
      return;
    }

    this.logger.log('Creating user_news_digest table...');

    await this.dataSource.query(`
      CREATE TABLE user_news_digest (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        digest_date DATE NOT NULL UNIQUE,
        news_items JSONB NOT NULL,
        summary TEXT,
        tasks JSONB,
        insights JSONB,
        generated_at TIMESTAMP DEFAULT NOW(),
        viewed BOOLEAN NOT NULL DEFAULT false
      )
    `);

    this.logger.log('Table user_news_digest created successfully');
  }

  private async createIndexes() {
    this.logger.log('Creating indexes for interests tables...');

    const indexes = [
      {
        name: 'idx_interests_confidence',
        query: 'CREATE INDEX IF NOT EXISTS idx_interests_confidence ON user_interests(confidence);',
      },
      {
        name: 'idx_interests_last_seen',
        query: 'CREATE INDEX IF NOT EXISTS idx_interests_last_seen ON user_interests(last_seen);',
      },
      {
        name: 'idx_evidence_interest_id',
        query: 'CREATE INDEX IF NOT EXISTS idx_evidence_interest_id ON interest_evidence(interest_id);',
      },
      {
        name: 'idx_subscriptions_enabled',
        query: 'CREATE INDEX IF NOT EXISTS idx_subscriptions_enabled ON topic_subscriptions(enabled);',
      },
      {
        name: 'idx_subscriptions_last_fetch',
        query: 'CREATE INDEX IF NOT EXISTS idx_subscriptions_last_fetch ON topic_subscriptions(last_fetch);',
      },
      {
        name: 'idx_news_items_topic',
        query: 'CREATE INDEX IF NOT EXISTS idx_news_items_topic ON news_items(topic, published_at);',
      },
      {
        name: 'idx_news_items_fetched',
        query: 'CREATE INDEX IF NOT EXISTS idx_news_items_fetched ON news_items(fetched_at);',
      },
      {
        name: 'idx_digest_date',
        query: 'CREATE INDEX IF NOT EXISTS idx_digest_date ON user_news_digest(digest_date);',
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
