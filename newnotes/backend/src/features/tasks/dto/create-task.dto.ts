import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  MaxLength,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from './task.enums';

export class CreateTaskDto {
  @ApiProperty({
    description: 'UUID of the note this task belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'note_id must be a valid UUID' })
  note_id: string;

  @ApiProperty({
    description: 'Task title',
    example: 'Complete project documentation',
    maxLength: 500,
  })
  @IsString({ message: 'title must be a string' })
  @MaxLength(500, { message: 'title cannot exceed 500 characters' })
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed task description',
    example: 'Write comprehensive documentation for the API endpoints including examples and error scenarios',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Task priority level',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    example: TaskPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(TaskPriority, {
    message: 'priority must be one of: low, medium, high, urgent',
  })
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'Task due date in ISO 8601 format',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'due_date must be a valid ISO 8601 date string' },
  )
  due_date?: string;

  @ApiPropertyOptional({
    description: 'Initial task status',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
    example: TaskStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TaskStatus, {
    message: 'status must be one of: pending, in_progress, completed, cancelled',
  })
  status?: TaskStatus = TaskStatus.PENDING;

  @ApiPropertyOptional({
    description: 'Additional task metadata as JSON object',
    example: { source: 'ai-extraction', confidence: 0.95 },
  })
  @IsOptional()
  @IsObject({ message: 'metadata must be a valid JSON object' })
  metadata?: Record<string, any>;
}
