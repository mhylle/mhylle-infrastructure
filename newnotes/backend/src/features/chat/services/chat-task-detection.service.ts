import { Injectable, Logger, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DetectedTask } from '../entities/detected-task.entity';
import { TaskAgentService } from '@features/llm-service/services/task-agent.service';
import { ExtractedTask } from '@features/llm-service/services/task-agent.interface';
import { ChatTaskDuplicationService } from './chat-task-duplication.service';
import { Task, TaskSource } from '@shared/entities/task.entity';
import { TaskContextService } from '@features/tasks/services/task-context.service';
import { SourceType } from '@shared/entities/task-context.entity';
import { RedisService } from '@core/redis/redis.service';
import { TASK_EVENTS } from '@features/events/schemas/task-events.schema';

export interface TaskDetectionResult {
  tasks: DetectedTask[];
  processingTimeMs: number;
  totalDetected: number;
}

@Injectable()
export class ChatTaskDetectionService {
  private readonly logger = new Logger(ChatTaskDetectionService.name);
  private readonly confidenceThreshold = 0.5;

  constructor(
    @InjectRepository(DetectedTask)
    private readonly detectedTaskRepository: Repository<DetectedTask>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly taskAgentService: TaskAgentService,
    @Inject(forwardRef(() => ChatTaskDuplicationService))
    private readonly duplicationService: ChatTaskDuplicationService,
    private readonly taskContextService: TaskContextService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  async detectTasksFromChatMessage(
    chatMessageId: string,
    messageContent: string,
  ): Promise<TaskDetectionResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Detecting tasks from chat message ${chatMessageId.substring(0, 8)}`,
      );

      // Extract tasks using the task agent
      const extractionResult =
        await this.taskAgentService.extractTasksFromNoteWithRetry(
          messageContent,
          3,
        );

      this.logger.debug(
        `Extracted ${extractionResult.tasks.length} tasks from chat message`,
      );

      // Filter by confidence threshold
      const highConfidenceTasks = extractionResult.tasks.filter(
        (task) => task.confidence >= this.confidenceThreshold,
      );

      if (highConfidenceTasks.length === 0) {
        this.logger.log(
          `No high-confidence tasks found for chat message ${chatMessageId.substring(0, 8)}`,
        );
        return {
          tasks: [],
          processingTimeMs: Date.now() - startTime,
          totalDetected: 0,
        };
      }

      // Save detected tasks to database
      const savedTasks = await this.saveDetectedTasks(
        chatMessageId,
        highConfidenceTasks,
      );

      // Trigger automatic duplicate checking asynchronously (fire-and-forget)
      // This won't block the response, checks happen in background
      this.checkForDuplicatesAsync(savedTasks);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Detected ${savedTasks.length} tasks for chat message ${chatMessageId.substring(0, 8)} in ${processingTime}ms`,
      );

      return {
        tasks: savedTasks,
        processingTimeMs: processingTime,
        totalDetected: savedTasks.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to detect tasks from chat message ${chatMessageId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDetectedTasksForMessage(
    chatMessageId: string,
  ): Promise<DetectedTask[]> {
    try {
      return await this.detectedTaskRepository.find({
        where: { chatMessageId },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get detected tasks for message ${chatMessageId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getActiveDetectedTasks(): Promise<DetectedTask[]> {
    try {
      return await this.detectedTaskRepository.find({
        where: { status: 'active' },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error(`Failed to get active tasks: ${error.message}`);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<DetectedTask> {
    try {
      const task = await this.detectedTaskRepository.findOne({
        where: { id: taskId },
      });

      if (!task) {
        throw new Error(`Detected task ${taskId} not found`);
      }

      task.status = 'deleted';
      task.updatedAt = new Date();

      return await this.detectedTaskRepository.save(task);
    } catch (error) {
      this.logger.error(
        `Failed to delete task ${taskId}: ${error.message}`,
      );
      throw error;
    }
  }

  private async saveDetectedTasks(
    chatMessageId: string,
    extractedTasks: ExtractedTask[],
  ): Promise<DetectedTask[]> {
    try {
      const tasksToSave = extractedTasks.map((task) => {
        const detectedTask = new DetectedTask();
        detectedTask.chatMessageId = chatMessageId;
        detectedTask.title = task.title;
        detectedTask.description = task.description || null;
        detectedTask.priority = task.priority;
        detectedTask.dueDate = task.dueDate || null;
        detectedTask.confidence = task.confidence;
        detectedTask.status = 'active';
        return detectedTask;
      });

      return await this.detectedTaskRepository.save(tasksToSave);
    } catch (error) {
      this.logger.error(
        `Failed to save detected tasks: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check for duplicates asynchronously (fire-and-forget)
   * Runs in background without blocking the main detection flow
   */
  private checkForDuplicatesAsync(detectedTasks: DetectedTask[]): void {
    // Process each task asynchronously
    detectedTasks.forEach((task) => {
      this.duplicationService
        .checkForDuplicates(task.id)
        .then((similarTasks) => {
          if (similarTasks.length > 0) {
            this.logger.log(
              `Found ${similarTasks.length} similar tasks for detected task ${task.id.substring(0, 8)}`,
            );
          }
        })
        .catch((error) => {
          this.logger.error(
            `Background duplicate check failed for task ${task.id}: ${error.message}`,
          );
          // Don't throw - this is a background operation
        });
    });
  }

  /**
   * Convert detected task to main task
   *
   * @param detectedTaskId - UUID of the detected task
   * @param noteId - Optional note ID to associate with
   * @param parentTaskId - Optional parent task ID for creating as subtask
   * @returns The created main task
   */
  async convertDetectedTaskToMainTask(
    detectedTaskId: string,
    noteId?: string,
    parentTaskId?: string,
  ): Promise<Task> {
    // Use transaction for data consistency
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get the detected task
      const detectedTask = await this.detectedTaskRepository.findOne({
        where: { id: detectedTaskId },
      });

      if (!detectedTask) {
        throw new NotFoundException(
          `Detected task with ID ${detectedTaskId} not found`,
        );
      }

      // Validate status
      if (detectedTask.status !== 'active') {
        throw new Error(
          `Cannot convert detected task with status '${detectedTask.status}'. Only 'active' tasks can be converted.`,
        );
      }

      // 2. Get chat message to extract context
      const chatMessage = await queryRunner.manager
        .createQueryBuilder()
        .select(['id', 'session_id'])
        .from('chat_messages', 'msg')
        .where('msg.id = :messageId', { messageId: detectedTask.chatMessageId })
        .getRawOne<{ id: string; session_id: string }>();

      // 3. Determine hierarchy level if parent task exists
      let level = 0;
      let orderIndex = 0;

      if (parentTaskId) {
        const parentTask = await this.taskRepository.findOne({
          where: { id: parentTaskId },
        });

        if (!parentTask) {
          throw new NotFoundException(
            `Parent task with ID ${parentTaskId} not found`,
          );
        }

        level = parentTask.level + 1;

        // Get max order_index for siblings
        const siblings = await this.taskRepository.find({
          where: { parent_task_id: parentTaskId },
          order: { order_index: 'DESC' },
        });

        orderIndex = siblings.length > 0 ? siblings[0].order_index + 1 : 0;
      } else {
        // Get max order_index for root tasks
        const rootTasks = await this.taskRepository.find({
          where: { parent_task_id: null as any },
          order: { order_index: 'DESC' },
        });

        orderIndex = rootTasks.length > 0 ? rootTasks[0].order_index + 1 : 0;
      }

      // 4. Create the main task
      const mainTask = this.taskRepository.create({
        title: detectedTask.title,
        description: detectedTask.description || '',
        priority: detectedTask.priority,
        status: 'pending',
        source: TaskSource.AI_DETECTED,
        note_id: noteId || null,
        parent_task_id: parentTaskId || null,
        level,
        order_index: orderIndex,
        due_date: detectedTask.dueDate || null,
        llm_confidence: Number(detectedTask.confidence),
        metadata: {
          detectedTaskId: detectedTask.id,
          confidence: detectedTask.confidence,
          chatMessageId: detectedTask.chatMessageId,
          convertedAt: new Date().toISOString(),
        },
      });

      const savedTask = await queryRunner.manager.save(Task, mainTask);

      this.logger.log(
        `Created main task ${savedTask.id} from detected task ${detectedTaskId}`,
      );

      // 5. Create task context to track origin (within same transaction)
      const taskContext = queryRunner.manager.create('TaskContext', {
        task_id: savedTask.id,
        source_type: SourceType.CHAT,
        source_id: detectedTask.chatMessageId,
        metadata: {
          detectedTaskId: detectedTask.id,
          confidence: detectedTask.confidence,
          sessionId: chatMessage?.session_id,
        },
      });

      await queryRunner.manager.save(taskContext);

      // 6. Update detected task status to 'converted'
      detectedTask.status = 'deleted'; // Using 'deleted' status as 'converted' is not in the enum
      detectedTask.updatedAt = new Date();

      await queryRunner.manager.save(DetectedTask, detectedTask);

      this.logger.log(
        `Updated detected task ${detectedTaskId} status to 'deleted' (converted)`,
      );

      // 7. Publish task created event for embedding generation
      try {
        await this.redisService.publish(TASK_EVENTS.TASK_CREATED, {
          taskId: savedTask.id,
          title: savedTask.title,
          description: savedTask.description,
          timestamp: new Date().toISOString(),
        });
        this.logger.log(`Published TASK_CREATED event for task ${savedTask.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to publish TASK_CREATED event: ${error.message}`,
        );
        // Don't throw - event failure shouldn't block task creation
      }

      // Commit transaction
      await queryRunner.commitTransaction();

      return savedTask;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to convert detected task ${detectedTaskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }
}
