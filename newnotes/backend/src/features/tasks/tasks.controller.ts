import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  TaskFilterDto,
} from './dto';
import { Task } from '@shared/entities/task.entity';

/**
 * TasksController - Handles HTTP requests for task management
 *
 * Routes:
 * - GET /api/notes/tasks - List all tasks with optional filtering
 * - GET /api/notes/tasks/:id - Get task by ID
 * - GET /api/notes/tasks/note/:noteId - Get tasks for specific note
 * - POST /api/notes/tasks - Create new task
 * - PATCH /api/notes/tasks/:id - Update task properties
 * - PATCH /api/notes/tasks/:id/status - Update task status
 * - DELETE /api/notes/tasks/:id - Delete task
 */
@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * GET /api/notes/tasks
   * List all tasks with optional filtering
   *
   * Query Parameters:
   * - noteId (UUID): Filter by note ID
   * - status: Filter by status (pending, in_progress, completed, cancelled)
   * - priority: Filter by priority (low, medium, high, urgent)
   * - dueDateFrom (ISO date): Filter tasks due after this date
   * - dueDateTo (ISO date): Filter tasks due before this date
   * - sortBy: Sort field (created_at, due_date, priority, status)
   * - sortOrder: Sort order (ASC, DESC)
   */
  @Get()
  @ApiOperation({ summary: 'List all tasks with optional filtering' })
  @ApiQuery({ name: 'noteId', required: false, type: String, description: 'Filter by note ID (UUID)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Filter by task status' })
  @ApiQuery({ name: 'priority', required: false, enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by task priority' })
  @ApiQuery({ name: 'dueDateFrom', required: false, type: String, description: 'Filter tasks due after this date (ISO 8601)' })
  @ApiQuery({ name: 'dueDateTo', required: false, type: String, description: 'Filter tasks due before this date (ISO 8601)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['created_at', 'due_date', 'priority', 'status'], description: 'Sort field (default: created_at)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order (default: DESC)' })
  @ApiResponse({ status: 200, description: 'List of tasks matching the filter criteria', type: [Task] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  async findAll(@Query() filters: TaskFilterDto): Promise<Task[]> {
    return this.tasksService.findAll(filters);
  }

  /**
   * GET /api/notes/tasks/note/:noteId
   * Get all tasks for a specific note
   *
   * IMPORTANT: This specific route must come BEFORE the generic :id route
   * to prevent NestJS from interpreting 'note' as a UUID parameter
   */
  @Get('note/:noteId')
  @ApiOperation({ summary: 'Get all tasks for a specific note' })
  @ApiParam({ name: 'noteId', type: String, description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'List of tasks for the specified note', type: [Task] })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async findByNoteId(@Param('noteId') noteId: string): Promise<Task[]> {
    return this.tasksService.findByNoteId(noteId);
  }

  /**
   * GET /api/notes/tasks/:id
   * Get a single task by ID
   *
   * IMPORTANT: This generic route must come AFTER specific routes
   * to prevent route matching conflicts (NestJS uses first-match-wins)
   *
   * @throws NotFoundException if task not found
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task found successfully', type: Task })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async findOne(@Param('id') id: string): Promise<Task> {
    return this.tasksService.findOne(id);
  }

  /**
   * POST /api/notes/tasks
   * Create a new task
   *
   * Returns 201 Created with the new task
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiBody({ type: CreateTaskDto, description: 'Task creation data' })
  @ApiResponse({ status: 201, description: 'Task created successfully', type: Task })
  @ApiResponse({ status: 400, description: 'Invalid request body or validation error' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(createTaskDto);
  }

  /**
   * PATCH /api/notes/tasks/:id
   * Update task properties (excluding status)
   *
   * Use PATCH /api/notes/tasks/:id/status for status updates
   *
   * @throws NotFoundException if task not found
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update task properties (excluding status)' })
  @ApiParam({ name: 'id', type: String, description: 'Task UUID' })
  @ApiBody({ type: UpdateTaskDto, description: 'Task update data (all fields optional)' })
  @ApiResponse({ status: 200, description: 'Task updated successfully', type: Task })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid request body or validation error' })
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(id, updateTaskDto);
  }

  /**
   * PATCH /api/notes/tasks/:id/status
   * Update task status with automatic completed_at handling
   *
   * Business Rules:
   * - When status changes to 'completed': completed_at = current timestamp
   * - When status changes from 'completed' to any other: completed_at = null
   *
   * @throws NotFoundException if task not found
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status with automatic completed_at handling' })
  @ApiParam({ name: 'id', type: String, description: 'Task UUID' })
  @ApiBody({ type: UpdateTaskStatusDto, description: 'Status update data' })
  @ApiResponse({ status: 200, description: 'Task status updated successfully', type: Task })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateTaskStatusDto,
  ): Promise<Task> {
    return this.tasksService.updateStatus(id, updateStatusDto);
  }

  /**
   * DELETE /api/notes/tasks/:id
   * Delete a task
   *
   * Returns 204 No Content on success
   *
   * @throws NotFoundException if task not found
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', type: String, description: 'Task UUID' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.tasksService.remove(id);
  }
}
