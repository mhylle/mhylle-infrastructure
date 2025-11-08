import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { RAGService } from '../services/rag.service';
import { ChatTaskDetectionService } from '../services/chat-task-detection.service';
import { ChatTaskDuplicationService } from '../services/chat-task-duplication.service';
import { CreateSessionDto } from '../dto/create-session.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  ChatSessionResponseDto,
  ChatMessageResponseDto,
} from '../dto/chat-response.dto';
import {
  CheckDuplicatesQueryDto,
  DuplicateCheckResultDto,
  MergeTaskDto,
  MergeTaskResultDto,
  IgnoreTaskResultDto,
} from '../dto/task-deduplication.dto';
import {
  ConvertDetectedTaskDto,
  ConvertedTaskResponseDto,
} from '../dto/convert-detected-task.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly ragService: RAGService,
    private readonly chatTaskDetectionService: ChatTaskDetectionService,
    private readonly chatTaskDuplicationService: ChatTaskDuplicationService,
  ) {}

  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSessionResponseDto> {
    this.logger.log('Creating new chat session');
    const session = await this.chatService.createSession(dto.title);

    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Get('sessions')
  async listSessions(): Promise<ChatSessionResponseDto[]> {
    this.logger.log('Listing all chat sessions');
    const sessions = await this.chatService.findAllSessions();

    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<ChatSessionResponseDto> {
    this.logger.log(`Retrieving session ${id}`);
    const session = await this.chatService.findSessionById(id);

    const messages: ChatMessageResponseDto[] = session.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sources: msg.sources,
      createdAt: msg.createdAt,
    }));

    return {
      id: session.id,
      title: session.title,
      messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Deleting session ${id}`);
    await this.chatService.deleteSession(id);
    return { message: 'Session deleted successfully' };
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    this.logger.log(`Sending message to session ${sessionId}`);

    try {
      // 1. Save user message
      await this.chatService.saveMessage({
        sessionId,
        role: 'user',
        content: dto.message,
      });

      // 2. Setup Server-Sent Events (SSE) streaming
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // 3. Query RAG service for streaming response
      const { stream, sources } = await this.ragService.query(
        dto.message,
        sessionId,
      );

      let fullResponse = '';

      // 4. Stream the response chunks
      stream.subscribe({
        next: (chunk) => {
          fullResponse += chunk;
          // Send chunk as SSE event
          response.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
        complete: async () => {
          try {
            // 5. Save assistant message with sources
            await this.chatService.saveMessage({
              sessionId,
              role: 'assistant',
              content: fullResponse,
              sources,
            });

            // 6. Send completion event
            response.write('data: [DONE]\n\n');
            response.end();

            this.logger.log(`Completed streaming response for session ${sessionId}`);
          } catch (error) {
            this.logger.error(
              `Failed to save assistant message: ${error.message}`,
              error.stack,
            );
            response.write(
              `data: ${JSON.stringify({ error: 'Failed to save message' })}\n\n`,
            );
            response.end();
          }
        },
        error: (error) => {
          this.logger.error(
            `Streaming error for session ${sessionId}: ${error.message}`,
            error.stack,
          );
          response.write(
            `data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`,
          );
          response.end();
        },
      });
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error.message || 'Failed to process message',
      });
    }
  }

  // ========== Task Detection Endpoints ==========

  @Post('messages/:messageId/detect-tasks')
  async detectTasksFromMessage(@Param('messageId') messageId: string) {
    this.logger.log(`Detecting tasks from message ${messageId}`);

    try {
      // Get the message content
      const message = await this.chatService.findMessageById(messageId);

      if (!message) {
        return {
          error: 'Message not found',
          statusCode: HttpStatus.NOT_FOUND,
        };
      }

      // Detect tasks from the message content
      const result =
        await this.chatTaskDetectionService.detectTasksFromChatMessage(
          messageId,
          message.content,
        );

      return {
        success: true,
        tasks: result.tasks,
        processingTimeMs: result.processingTimeMs,
        totalDetected: result.totalDetected,
      };
    } catch (error) {
      this.logger.error(
        `Failed to detect tasks from message ${messageId}: ${error.message}`,
        error.stack,
      );
      return {
        error: error.message || 'Failed to detect tasks',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Get('detected-tasks/active')
  async getActiveDetectedTasks() {
    this.logger.log('Getting active detected tasks');

    try {
      const tasks =
        await this.chatTaskDetectionService.getActiveDetectedTasks();

      return {
        success: true,
        tasks,
        count: tasks.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get active tasks: ${error.message}`,
        error.stack,
      );
      return {
        error: error.message || 'Failed to get active tasks',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Get('messages/:messageId/detected-tasks')
  async getDetectedTasksForMessage(@Param('messageId') messageId: string) {
    this.logger.log(`Getting detected tasks for message ${messageId}`);

    try {
      const tasks =
        await this.chatTaskDetectionService.getDetectedTasksForMessage(
          messageId,
        );

      return {
        success: true,
        tasks,
        count: tasks.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get tasks for message ${messageId}: ${error.message}`,
        error.stack,
      );
      return {
        error: error.message || 'Failed to get tasks for message',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Delete('detected-tasks/:taskId')
  async deleteDetectedTask(@Param('taskId') taskId: string) {
    this.logger.log(`Deleting task ${taskId}`);

    try {
      const task = await this.chatTaskDetectionService.deleteTask(taskId);

      return {
        success: true,
        task,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete task ${taskId}: ${error.message}`,
        error.stack,
      );
      return {
        error: error.message || 'Failed to delete task',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  // ========== Task Deduplication Endpoints ==========

  @Post('detected-tasks/:id/check-duplicates')
  @ApiOperation({
    summary: 'Manually trigger duplicate check for a detected task',
    description:
      'Checks for similar/duplicate tasks using embedding cosine similarity. ' +
      'Automatic checking happens in background, use this to force re-check or check manually.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Detected task UUID' })
  @ApiQuery({
    name: 'threshold',
    required: false,
    type: Number,
    description: 'Minimum similarity score (0.0-1.0, default: 0.8)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of results (default: 5)',
  })
  @ApiResponse({
    status: 200,
    description: 'Duplicate check completed successfully',
    type: DuplicateCheckResultDto,
  })
  @ApiResponse({ status: 404, description: 'Detected task not found' })
  async checkDuplicates(
    @Param('id') detectedTaskId: string,
    @Query() query: CheckDuplicatesQueryDto,
  ): Promise<DuplicateCheckResultDto> {
    const startTime = Date.now();
    this.logger.log(`Checking duplicates for detected task ${detectedTaskId}`);

    try {
      const threshold = query.threshold ?? 0.8;
      const limit = query.limit ?? 5;

      const similarTasks =
        await this.chatTaskDuplicationService.checkForDuplicates(
          detectedTaskId,
          threshold,
          limit,
        );

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        hasDuplicates: similarTasks.length > 0,
        count: similarTasks.length,
        similarTasks,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check duplicates for task ${detectedTaskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('detected-tasks/:id/similar')
  @ApiOperation({
    summary: 'Get similar tasks for a detected task',
    description:
      'Returns cached similar tasks from previous duplicate check. ' +
      'If duplicate check has not been completed, returns error.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Detected task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Similar tasks retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        detectedTask: { type: 'object' },
        hasDuplicates: { type: 'boolean' },
        similarTasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              similarity: { type: 'number' },
              title: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Detected task not found' })
  @ApiResponse({
    status: 400,
    description: 'Duplicate check not yet completed',
  })
  async getSimilarTasks(@Param('id') detectedTaskId: string) {
    this.logger.log(`Getting similar tasks for detected task ${detectedTaskId}`);

    try {
      const detectedTask =
        await this.chatTaskDuplicationService.getSimilarTasks(detectedTaskId);

      return {
        success: true,
        detectedTask: {
          id: detectedTask.id,
          title: detectedTask.title,
          description: detectedTask.description,
          duplicateCheckCompleted: detectedTask.duplicateCheckCompleted,
          hasDuplicates: detectedTask.hasDuplicates,
        },
        hasDuplicates: detectedTask.hasDuplicates,
        similarTasks: detectedTask.similarTaskIds || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to get similar tasks for ${detectedTaskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('detected-tasks/:id/merge')
  @ApiOperation({
    summary: 'Merge detected task with existing task',
    description:
      'Marks the detected task as deleted and optionally updates the existing task. ' +
      'Does not create a new task - the existing task remains.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Detected task UUID' })
  @ApiBody({ type: MergeTaskDto })
  @ApiResponse({
    status: 200,
    description: 'Task merged successfully',
    type: MergeTaskResultDto,
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async mergeTask(
    @Param('id') detectedTaskId: string,
    @Body() dto: MergeTaskDto,
  ): Promise<MergeTaskResultDto> {
    this.logger.log(
      `Merging detected task ${detectedTaskId} with existing task ${dto.existingTaskId}`,
    );

    try {
      const mergedTask =
        await this.chatTaskDuplicationService.mergeWithExistingTask(
          detectedTaskId,
          dto.existingTaskId,
        );

      return {
        success: true,
        task: mergedTask,
        mergedDetectedTaskId: detectedTaskId,
        message: 'Detected task merged with existing task successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to merge tasks: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('detected-tasks/:id/ignore')
  @ApiOperation({
    summary: 'Ignore detected task as duplicate',
    description:
      'Marks the detected task as deleted without creating a new task. ' +
      'Use when user confirms the task is a duplicate and should not be kept.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Detected task UUID' })
  @ApiResponse({
    status: 200,
    description: 'Task ignored successfully',
    type: IgnoreTaskResultDto,
  })
  @ApiResponse({ status: 404, description: 'Detected task not found' })
  async ignoreTask(
    @Param('id') detectedTaskId: string,
  ): Promise<IgnoreTaskResultDto> {
    this.logger.log(`Ignoring detected task ${detectedTaskId} as duplicate`);

    try {
      await this.chatTaskDuplicationService.ignoreAsDuplicate(detectedTaskId);

      return {
        success: true,
        detectedTaskId,
        message: 'Detected task marked as duplicate and ignored',
      };
    } catch (error) {
      this.logger.error(
        `Failed to ignore task ${detectedTaskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('detected-tasks/:id/create-task')
  @ApiOperation({
    summary: 'Convert detected task to main task',
    description:
      'Creates a main task from a detected task. ' +
      'The detected task will be marked as converted (deleted status). ' +
      'Optionally associate with a note or create as a subtask.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Detected task UUID' })
  @ApiBody({
    type: ConvertDetectedTaskDto,
    required: false,
    description: 'Optional note ID or parent task ID',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: ConvertedTaskResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Detected task not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid task status or parent task not found',
  })
  async convertDetectedTaskToMainTask(
    @Param('id') detectedTaskId: string,
    @Body() dto?: ConvertDetectedTaskDto,
  ): Promise<ConvertedTaskResponseDto> {
    this.logger.log(
      `Converting detected task ${detectedTaskId} to main task`,
    );

    try {
      const createdTask =
        await this.chatTaskDetectionService.convertDetectedTaskToMainTask(
          detectedTaskId,
          dto?.noteId,
          dto?.parentTaskId,
        );

      return {
        success: true,
        task: createdTask,
        detectedTaskId,
        message: 'Detected task successfully converted to main task',
      };
    } catch (error) {
      this.logger.error(
        `Failed to convert detected task ${detectedTaskId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
