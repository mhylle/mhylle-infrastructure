import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalModelService } from './local-model.service';
import { TASK_EXTRACTION_PROMPT } from '../prompts/task-extraction.prompt';
import {
  ITaskAgentService,
  ExtractedTask,
  TaskExtractionResult,
} from './task-agent.interface';

@Injectable()
export class TaskAgentService implements ITaskAgentService {
  private readonly logger = new Logger(TaskAgentService.name);

  constructor(
    private readonly localModelService: LocalModelService,
    private readonly configService: ConfigService,
  ) {}

  async extractTasksFromNote(
    noteContent: string,
  ): Promise<TaskExtractionResult> {
    const startTime = Date.now();

    try {
      this.logger.debug('Extracting tasks from note content');

      const prompt = TASK_EXTRACTION_PROMPT(noteContent);

      const response = await this.localModelService.generateCompletion({
        prompt,
        config: {
          temperature: 0.3,
          maxTokens: 2048,
        },
      });

      const tasks = this.parseTasksFromResponse(response.text);
      const processingTime = Date.now() - startTime;

      this.logger.debug(
        `Extracted ${tasks.length} tasks in ${processingTime}ms`,
      );

      return {
        tasks,
        processingTimeMs: processingTime,
        modelUsed: response.model,
      };
    } catch (error) {
      this.logger.error(`Task extraction failed: ${error.message}`);
      throw error;
    }
  }

  async extractTasksFromNoteWithRetry(
    noteContent: string,
    maxRetries: number = 3,
  ): Promise<TaskExtractionResult> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Task extraction attempt ${attempt}/${maxRetries}`);
        return await this.extractTasksFromNote(noteContent);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Attempt ${attempt} failed: ${error.message}. Retrying...`,
        );

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await this.sleep(backoffMs);
        }
      }
    }

    this.logger.error(
      `Task extraction failed after ${maxRetries} attempts: ${lastError.message}`,
    );
    throw lastError;
  }

  private parseTasksFromResponse(responseText: string): ExtractedTask[] {
    try {
      const cleanedText = this.cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedText);

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        this.logger.warn('Invalid response structure: missing tasks array');
        return [];
      }

      return parsed.tasks
        .filter((task: any) => this.isValidTask(task))
        .map((task: any) => this.normalizeTask(task));
    } catch (error) {
      this.logger.error(`Failed to parse tasks: ${error.message}`);
      return [];
    }
  }

  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned;
  }

  private isValidTask(task: any): boolean {
    if (!task || typeof task !== 'object') {
      return false;
    }

    if (!task.title || typeof task.title !== 'string') {
      return false;
    }

    if (task.confidence !== undefined && typeof task.confidence !== 'number') {
      return false;
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (task.priority && !validPriorities.includes(task.priority)) {
      return false;
    }

    return true;
  }

  private normalizeTask(task: any): ExtractedTask {
    const normalized: ExtractedTask = {
      title: task.title.trim(),
      description: task.description?.trim() || undefined,
      priority: task.priority || 'medium',
      confidence: task.confidence ?? 0.5,
    };

    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      if (!isNaN(dueDate.getTime())) {
        normalized.dueDate = dueDate;
      }
    }

    return normalized;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
