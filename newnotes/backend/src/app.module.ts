import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '@core/database/database.module';
import { RedisModule } from '@core/redis/redis.module';
import { HealthModule } from '@core/health/health.module';
import { NotesModule } from '@features/notes/notes.module';
import { LLMModule } from '@features/llm-service/llm.module';
import { TasksModule } from '@features/tasks/tasks.module';
import { EmbeddingsModule } from '@features/embeddings/embeddings.module';
import { SearchModule } from '@features/search/search.module';
import { ChatModule } from '@features/chat/chat.module';
import { RelationshipsModule } from '@features/relationships/relationships.module';
import { InterestsModule } from '@features/interests/interests.module';
import { NewsModule } from '@features/news/news.module';
import { OrchestratorModule } from './features/orchestrator/orchestrator.module';
import configuration from '@core/config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    RedisModule,
    HealthModule,
    NotesModule,
    LLMModule,
    TasksModule,
    EmbeddingsModule,
    SearchModule,
    ChatModule,
    RelationshipsModule,
    InterestsModule,
    NewsModule,
    OrchestratorModule,
  ],
})
export class AppModule {}
