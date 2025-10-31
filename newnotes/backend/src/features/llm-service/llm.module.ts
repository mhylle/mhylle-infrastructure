import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocalModelService } from './services/local-model.service';
import { TaskAgentService } from './services/task-agent.service';
import { TaskRepository } from './repositories/task.repository';
import { TaskExtractionListener } from './listeners/task-extraction.listener';
import { Task } from '../../shared/entities/task.entity';
import { RedisModule } from '@core/redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), RedisModule],
  providers: [
    LocalModelService,
    TaskAgentService,
    TaskRepository,
    TaskExtractionListener,
  ],
  exports: [LocalModelService, TaskAgentService, TaskRepository],
})
export class LLMModule {}
