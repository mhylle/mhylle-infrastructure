import { IsOptional, IsUUID, IsEnum, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from './task.enums';

export class TaskFilterDto {
  @ApiPropertyOptional({
    description: 'Filter tasks by note UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'noteId must be a valid UUID' })
  noteId?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks by status',
    enum: TaskStatus,
    example: TaskStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TaskStatus, {
    message: 'status must be one of: pending, in_progress, completed, cancelled',
  })
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter tasks by priority level',
    enum: TaskPriority,
    example: TaskPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(TaskPriority, {
    message: 'priority must be one of: low, medium, high, urgent',
  })
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'Filter tasks with due date after this date (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'dueDateFrom must be a valid ISO 8601 date string' },
  )
  dueDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks with due date before this date (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'dueDateTo must be a valid ISO 8601 date string' },
  )
  dueDateTo?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['created_at', 'due_date', 'priority', 'status'],
    default: 'created_at',
    example: 'due_date',
  })
  @IsOptional()
  @IsIn(['created_at', 'due_date', 'priority', 'status'], {
    message: 'sortBy must be one of: created_at, due_date, priority, status',
  })
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'ASC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'], {
    message: 'sortOrder must be either ASC or DESC',
  })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
