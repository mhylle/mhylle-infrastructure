import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { RAGService } from './services/rag.service';
import { ChatMigrationService } from './services/chat-migration.service';
import { SearchModule } from '@features/search/search.module';
import { LLMModule } from '@features/llm-service/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
    SearchModule,
    LLMModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, RAGService, ChatMigrationService],
  exports: [ChatService, RAGService],
})
export class ChatModule {}
