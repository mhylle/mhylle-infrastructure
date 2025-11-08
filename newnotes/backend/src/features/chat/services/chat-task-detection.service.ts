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
import { EmbeddingsService } from '@features/embeddings/services/embeddings.service';
import { TaskEmbedding } from '@features/embeddings/entities/task-embedding.entity';

export interface TaskDetectionResult {
  tasks: DetectedTask[];
  processingTimeMs: number;
  totalDetected: number;
  duplicates: number;
  skipped: number;
}

@Injectable()
export class ChatTaskDetectionService {
  private readonly logger = new Logger(ChatTaskDetectionService.name);
  private readonly confidenceThreshold = 0.5;
  private readonly similarityThreshold = 0.85; // Tasks >85% similar = duplicate

  constructor(
    @InjectRepository(DetectedTask)
    private readonly detectedTaskRepository: Repository<DetectedTask>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(TaskEmbedding)
    private readonly taskEmbeddingRepository: Repository<TaskEmbedding>,
    private readonly taskAgentService: TaskAgentService,
    @Inject(forwardRef(() => ChatTaskDuplicationService))
    private readonly duplicationService: ChatTaskDuplicationService,
    private readonly taskContextService: TaskContextService,
    private readonly redisService: RedisService,
    private readonly embeddingsService: EmbeddingsService,
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
          duplicates: 0,
          skipped: 0,
        };
      }

      // Check for duplicates BEFORE saving
      const deduplicationResult = await this.deduplicateTasks(highConfidenceTasks);

      this.logger.log(
        `Deduplication: ${deduplicationResult.unique.length} unique, ${deduplicationResult.duplicates.length} duplicates (${deduplicationResult.duplicates.length} skipped)`,
      );

      // Save only unique detected tasks to database
      const savedTasks = await this.saveDetectedTasks(
        chatMessageId,
        deduplicationResult.unique,
      );

      // Trigger automatic duplicate checking asynchronously for additional validation
      // This is now primarily for updating duplicate metadata
      this.checkForDuplicatesAsync(savedTasks);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Detected ${savedTasks.length} unique tasks (skipped ${deduplicationResult.duplicates.length} duplicates) for chat message ${chatMessageId.substring(0, 8)} in ${processingTime}ms`,
      );

      return {
        tasks: savedTasks,
        processingTimeMs: processingTime,
        totalDetected: highConfidenceTasks.length,
        duplicates: deduplicationResult.duplicates.length,
        skipped: deduplicationResult.duplicates.length,
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
   * Deduplicate extracted tasks BEFORE saving to database
   *
   * This method:
   * 1. Generates embeddings for each extracted task
   * 2. Checks similarity against existing detected_tasks (active only)
   * 3. Checks similarity against main tasks table
   * 4. Returns unique tasks and list of duplicates
   *
   * @param extractedTasks - Tasks extracted by the LLM
   * @returns Object with unique tasks and duplicates
   */
  private async deduplicateTasks(
    extractedTasks: ExtractedTask[],
  ): Promise<{
    unique: ExtractedTask[];
    duplicates: Array<{ task: ExtractedTask; reason: string; similarity: number }>;
  }> {
    const unique: ExtractedTask[] = [];
    const duplicates: Array<{ task: ExtractedTask; reason: string; similarity: number }> = [];

    this.logger.debug(`Deduplicating ${extractedTasks.length} extracted tasks`);

    for (const task of extractedTasks) {
      try {
        // Build search text from task
        const searchText = this.buildSearchTextFromExtractedTask(task);

        // Generate embedding for the task
        const embedding = await this.embeddingsService.generateEmbedding(searchText);

        // Check against existing detected_tasks (active only)
        const similarDetectedTasks = await this.findSimilarDetectedTasks(
          embedding,
          this.similarityThreshold,
        );

        if (similarDetectedTasks.length > 0) {
          const topMatch = similarDetectedTasks[0];
          this.logger.debug(
            `Task "${task.title}" is duplicate of detected_task "${topMatch.title}" (similarity: ${topMatch.similarity.toFixed(2)})`,
          );
          duplicates.push({
            task,
            reason: `Similar to detected task: "${topMatch.title}"`,
            similarity: topMatch.similarity,
          });
          continue;
        }

        // Check against main tasks table
        const similarMainTasks = await this.findSimilarMainTasks(
          embedding,
          this.similarityThreshold,
        );

        if (similarMainTasks.length > 0) {
          const topMatch = similarMainTasks[0];
          this.logger.debug(
            `Task "${task.title}" is duplicate of main task "${topMatch.title}" (similarity: ${topMatch.similarity.toFixed(2)})`,
          );
          duplicates.push({
            task,
            reason: `Similar to existing task: "${topMatch.title}"`,
            similarity: topMatch.similarity,
          });
          continue;
        }

        // Task is unique
        unique.push(task);
      } catch (error) {
        this.logger.error(
          `Error checking task "${task.title}" for duplicates: ${error.message}`,
          error.stack,
        );
        // On error, include the task to avoid losing it
        unique.push(task);
      }
    }

    this.logger.log(
      `Deduplication complete: ${unique.length} unique, ${duplicates.length} duplicates`,
    );

    return { unique, duplicates };
  }

  /**
   * Build search text from extracted task for embedding generation
   */
  private buildSearchTextFromExtractedTask(task: ExtractedTask): string {
    const parts = [task.title];
    if (task.description) {
      parts.push(task.description);
    }
    return parts.join(' ');
  }

  /**
   * Find similar detected tasks using embedding vector search
   */
  private async findSimilarDetectedTasks(
    embedding: number[],
    threshold: number,
    limit: number = 5,
  ): Promise<Array<{ id: string; title: string; similarity: number }>> {
    try {
      // Convert embedding to pgvector format
      const embeddingStr = `[${embedding.join(',')}]`;
      const distanceThreshold = 2 * (1 - threshold);

      // For detected_tasks, we need to generate embeddings on-the-fly since they don't have stored embeddings
      // Instead, we'll search active detected tasks and calculate similarity
      const activeTasks = await this.detectedTaskRepository.find({
        where: { status: 'active' },
      });

      const similarities: Array<{ id: string; title: string; similarity: number }> = [];

      // Calculate similarity for each active detected task
      for (const detectedTask of activeTasks) {
        try {
          const taskText = this.buildSearchTextFromDetectedTask(detectedTask);
          const taskEmbedding = await this.embeddingsService.generateEmbedding(taskText);

          // Calculate cosine similarity
          const similarity = this.calculateCosineSimilarity(embedding, taskEmbedding);

          if (similarity >= threshold) {
            similarities.push({
              id: detectedTask.id,
              title: detectedTask.title,
              similarity,
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to calculate similarity for detected task ${detectedTask.id}: ${error.message}`,
          );
        }
      }

      // Sort by similarity descending and limit results
      return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Failed to find similar detected tasks: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Build search text from detected task entity
   */
  private buildSearchTextFromDetectedTask(detectedTask: DetectedTask): string {
    const parts = [detectedTask.title];
    if (detectedTask.description) {
      parts.push(detectedTask.description);
    }
    return parts.join(' ');
  }

  /**
   * Find similar main tasks using embedding vector search with task_embeddings table
   */
  private async findSimilarMainTasks(
    embedding: number[],
    threshold: number,
    limit: number = 5,
  ): Promise<Array<{ id: string; title: string; similarity: number }>> {
    try {
      // Convert embedding to pgvector format
      const embeddingStr = `[${embedding.join(',')}]`;
      const distanceThreshold = 2 * (1 - threshold);

      // Query using pgvector cosine distance
      const results = await this.taskRepository
        .createQueryBuilder('t')
        .select(['t.id', 't.title'])
        .addSelect('(te.embedding <-> :embedding::vector)', 'distance')
        .addSelect('1 - ((te.embedding <-> :embedding::vector) / 2)', 'similarity')
        .innerJoin('task_embeddings', 'te', 'te."taskId" = t.id')
        .where('(te.embedding <-> :embedding::vector) <= :distanceThreshold')
        .setParameters({
          embedding: embeddingStr,
          distanceThreshold,
        })
        .orderBy('distance', 'ASC')
        .limit(limit)
        .getRawMany();

      return results.map((row) => ({
        id: row.t_id,
        title: row.t_title,
        similarity: parseFloat(row.similarity),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find similar main tasks: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Returns a value between 0 (completely different) and 1 (identical)
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
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
