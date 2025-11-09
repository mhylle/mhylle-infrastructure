import { Module } from '@nestjs/common';
import { RuleBasedRouterService } from './services/rule-based-router.service';
import { LLMIntentClassifierService } from './services/llm-intent-classifier.service';
import { LLMModule } from '@features/llm-service/llm.module';

@Module({
  imports: [LLMModule],
  providers: [RuleBasedRouterService, LLMIntentClassifierService],
  exports: [RuleBasedRouterService, LLMIntentClassifierService],
})
export class OrchestratorModule {}
