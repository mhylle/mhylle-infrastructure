import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from './task.enums';

export class UpdateTaskDto {
  @ApiPropertyOptional({
    description: 'Task title',
    example: 'Updated task title',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'title must be a string' })
  @MaxLength(500, { message: 'title cannot exceed 500 characters' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Detailed task description',
    example: 'Updated task description with more details',
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Task priority level',
    enum: TaskPriority,
    example: TaskPriority.URGENT,
  })
  @IsOptional()
  @IsEnum(TaskPriority, {
    message: 'priority must be one of: low, medium, high, urgent',
  })
  priority?: TaskPriority;

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
    description: 'Additional task metadata as JSON object',
    example: { updated_by: 'user', reason: 'priority change' },
  })
  @IsOptional()
  @IsObject({ message: 'metadata must be a valid JSON object' })
  metadata?: Record<string, any>;
}
