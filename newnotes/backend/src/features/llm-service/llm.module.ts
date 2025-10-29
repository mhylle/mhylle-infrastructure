import { Module } from '@nestjs/common';
import { LocalModelService } from './services/local-model.service';

@Module({
  providers: [LocalModelService],
  exports: [LocalModelService],
})
export class LLMModule {}
