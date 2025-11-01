import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ChatMigrationService implements OnModuleInit {
  private readonly logger = new Logger(ChatMigrationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Running chat database migrations...');
    await this.ensureChatSessionsTableExists();
    await this.ensureChatMessagesTableExists();
    await this.ensureIndexes();
    this.logger.log('Chat database migrations complete');
  }

  private async ensureChatSessionsTableExists(): Promise<void> {
    try {
      const tableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'chat_sessions'
        )
      `);

      if (!tableExists[0].exists) {
        this.logger.log('Creating chat_sessions table...');
        await this.dataSource.query(`
          CREATE TABLE chat_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        this.logger.log('chat_sessions table created');
      } else {
        this.logger.log('chat_sessions table already exists');
      }
    } catch (error) {
      this.logger.error(
        `Failed to create chat_sessions table: ${error.message}`,
      );
      throw error;
    }
  }

  private async ensureChatMessagesTableExists(): Promise<void> {
    try {
      const tableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'chat_messages'
        )
      `);

      if (!tableExists[0].exists) {
        this.logger.log('Creating chat_messages table...');
        await this.dataSource.query(`
          CREATE TABLE chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL,
            role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            sources JSONB,
            created_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT "FK_chat_messages_session"
              FOREIGN KEY (session_id)
              REFERENCES chat_sessions(id)
              ON DELETE CASCADE
          )
        `);
        this.logger.log('chat_messages table created');
      } else {
        this.logger.log('chat_messages table already exists');
      }
    } catch (error) {
      this.logger.error(
        `Failed to create chat_messages table: ${error.message}`,
      );
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    try {
      // Index on session_id and created_at for efficient message retrieval
      const messagesIndexExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'chat_messages'
          AND indexname = 'idx_chat_messages_session'
        )
      `);

      if (!messagesIndexExists[0].exists) {
        this.logger.log('Creating index on chat_messages(session_id, created_at)...');
        await this.dataSource.query(`
          CREATE INDEX idx_chat_messages_session
          ON chat_messages(session_id, created_at)
        `);
        this.logger.log('Index on chat_messages created');
      } else {
        this.logger.log('Index on chat_messages already exists');
      }

      // Index on chat_sessions updated_at for listing sessions
      const sessionsIndexExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'chat_sessions'
          AND indexname = 'idx_chat_sessions_updated_at'
        )
      `);

      if (!sessionsIndexExists[0].exists) {
        this.logger.log('Creating index on chat_sessions(updated_at)...');
        await this.dataSource.query(`
          CREATE INDEX idx_chat_sessions_updated_at
          ON chat_sessions(updated_at DESC)
        `);
        this.logger.log('Index on chat_sessions created');
      } else {
        this.logger.log('Index on chat_sessions already exists');
      }
    } catch (error) {
      this.logger.error(`Failed to create indexes: ${error.message}`);
      // Don't throw - indexes are not critical for basic functionality
    }
  }
}
