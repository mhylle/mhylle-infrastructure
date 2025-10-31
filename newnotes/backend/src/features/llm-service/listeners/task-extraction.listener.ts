import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@core/redis/redis.service';
import { TaskAgentService } from '../services/task-agent.service';
import { TaskRepository } from '../repositories/task.repository';
import { NOTE_EVENTS } from '@features/events/schemas/note-events.schema';
import { NoteCreatedEvent } from '@shared/events/note-created.event';

@Injectable()
export class TaskExtractionListener implements OnModuleInit {
  private readonly logger = new Logger(TaskExtractionListener.name);
  private readonly confidenceThreshold: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly taskAgentService: TaskAgentService,
    private readonly taskRepository: TaskRepository,
    private readonly configService: ConfigService,
  ) {
    this.confidenceThreshold =
      this.configService.get<number>('llm.confidenceThreshold') || 0.5;
  }

  async onModuleInit() {
    this.logger.log('Initializing TaskExtractionListener');

    try {
      await this.redisService.subscribe(
        NOTE_EVENTS.NOTE_CREATED,
        this.handleNoteCreated.bind(this),
      );
      this.logger.log(
        `Subscribed to ${NOTE_EVENTS.NOTE_CREATED} channel successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to ${NOTE_EVENTS.NOTE_CREATED}: ${error.message}`,
      );
    }
  }

  private async handleNoteCreated(data: any): Promise<void> {
    try {
      this.logger.debug('Received NOTE_CREATED event');

      const event = data as NoteCreatedEvent;

      if (!event.noteId || !event.content) {
        this.logger.warn('Invalid NOTE_CREATED event: missing required fields');
        return;
      }

      this.logger.log(`Processing note ${event.noteId} for task extraction`);

      // Extract tasks from note content
      const result =
        await this.taskAgentService.extractTasksFromNoteWithRetry(
          event.rawContent || event.content,
          3,
        );

      this.logger.debug(
        `Extracted ${result.tasks.length} tasks in ${result.processingTimeMs}ms`,
      );

      // Filter tasks by confidence threshold
      const highConfidenceTasks = result.tasks.filter(
        (task) => task.confidence >= this.confidenceThreshold,
      );

      if (highConfidenceTasks.length === 0) {
        this.logger.log(
          `No tasks with confidence >= ${this.confidenceThreshold} found for note ${event.noteId}`,
        );
        return;
      }

      this.logger.log(
        `Found ${highConfidenceTasks.length} high-confidence tasks (threshold: ${this.confidenceThreshold})`,
      );

      // Save tasks to database
      const savedTasks = await this.taskRepository.createTasksForNote(
        event.noteId,
        highConfidenceTasks,
      );

      this.logger.log(
        `Successfully saved ${savedTasks.length} tasks for note ${event.noteId}`,
      );

      // Log task details
      savedTasks.forEach((task) => {
        this.logger.debug(
          `Task created: ${task.title} (confidence: ${task.llm_confidence}, priority: ${task.priority})`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling NOTE_CREATED event: ${error.message}`,
        error.stack,
      );
    }
  }
}
