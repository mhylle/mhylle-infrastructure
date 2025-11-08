import { Module, Logger, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInterest } from './entities/user-interest.entity';
import { InterestEvidence } from './entities/interest-evidence.entity';
import { TopicSubscription } from './entities/topic-subscription.entity';
import { InterestEmbedding } from './entities/interest-embedding.entity';
import { InterestSimilarity } from './entities/interest-similarity.entity';
import { InterestHierarchy } from './entities/interest-hierarchy.entity';
import { InterestRecommendation } from './entities/interest-recommendation.entity';
import { Note } from '../../shared/entities/note.entity';
import { Task } from '../../shared/entities/task.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { InterestDetectionService } from './services/interest-detection.service';
import { InterestsMigrationService } from './services/interests-migration.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { InterestSimilarityService } from './services/interest-similarity.service';
import { InterestHierarchyService } from './services/interest-hierarchy.service';
import { InterestRecommendationsService } from './services/interest-recommendations.service';
import { ChatInterestListener } from './listeners/chat-interest.listener';
import { InterestsController } from './controllers/interests.controller';
import { LLMModule } from '../llm-service/llm.module';
import { ChatModule } from '../chat/chat.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { InterestEmbeddingRepository } from './repositories/interest-embedding.repository';
import { InterestSimilarityRepository } from './repositories/interest-similarity.repository';
import { InterestHierarchyRepository } from './repositories/interest-hierarchy.repository';
import { InterestRecommendationRepository } from './repositories/interest-recommendation.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserInterest,
      InterestEvidence,
      TopicSubscription,
      InterestEmbedding,
      InterestSimilarity,
      InterestHierarchy,
      InterestRecommendation,
      Note,
      Task,
      ChatMessage,
    ]),
    LLMModule,
    EmbeddingsModule,
    forwardRef(() => ChatModule), // Use forwardRef to avoid circular dependency
  ],
  controllers: [InterestsController],
  providers: [
    InterestDetectionService,
    InterestsMigrationService,
    SubscriptionsService,
    InterestSimilarityService,
    InterestHierarchyService,
    InterestRecommendationsService,
    ChatInterestListener,
    InterestEmbeddingRepository,
    InterestSimilarityRepository,
    InterestHierarchyRepository,
    InterestRecommendationRepository,
    Logger,
  ],
  exports: [
    InterestDetectionService,
    SubscriptionsService,
    InterestSimilarityService,
    InterestHierarchyService,
    InterestRecommendationsService,
  ],
})
export class InterestsModule {}
