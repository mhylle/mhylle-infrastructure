import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRepository } from '@features/llm-service/repositories/task.repository';
import { Task } from '@shared/entities/task.entity';

/**
 * TasksModule - Feature module for task management
 *
 * Provides:
 * - TasksController: HTTP endpoints for task operations
 * - TasksService: Business logic layer
 * - TaskRepository: Data access layer
 *
 * Imports:
 * - TypeOrmModule.forFeature([Task]): Register Task entity for TypeORM
 *
 * Exports:
 * - TasksService: Available for other modules to use
 * - TaskRepository: Available for other modules to use
 */
@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  controllers: [TasksController],
  providers: [TasksService, TaskRepository],
  exports: [TasksService, TaskRepository],
})
export class TasksModule {}
