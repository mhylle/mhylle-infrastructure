import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@core/redis/redis.module';
import { NoteEmbedding } from './entities/note-embedding.entity';
import { NoteEmbeddingRepository } from './repositories/note-embedding.repository';
import { EmbeddingsService } from './services/embeddings.service';
import { NoteEmbeddingListener } from './listeners/note-embedding.listener';
import { EmbeddingsMigrationService } from './services/embeddings-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NoteEmbedding]),
    HttpModule.register({
      timeout: 30000, // 30 second timeout for embedding generation
      maxRedirects: 5,
    }),
    ConfigModule,
    RedisModule,
  ],
  providers: [
    NoteEmbeddingRepository,
    EmbeddingsService,
    EmbeddingsMigrationService,
    NoteEmbeddingListener,
  ],
  exports: [EmbeddingsService, NoteEmbeddingRepository],
})
export class EmbeddingsModule {}
