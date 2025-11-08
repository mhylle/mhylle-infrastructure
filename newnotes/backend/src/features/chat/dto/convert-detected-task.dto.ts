import { IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for converting detected task to main task
 */
export class ConvertDetectedTaskDto {
  @ApiProperty({
    description: 'Optional note ID to associate the task with',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  noteId?: string;

  @ApiProperty({
    description: 'Optional parent task ID for creating as subtask',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;
}

/**
 * Response DTO for converted task
 */
export class ConvertedTaskResponseDto {
  @ApiProperty({
    description: 'Success status',
    type: Boolean,
  })
  success: boolean;

  @ApiProperty({
    description: 'Created main task',
    type: Object,
  })
  task: any;

  @ApiProperty({
    description: 'Original detected task ID',
    type: String,
  })
  detectedTaskId: string;

  @ApiProperty({
    description: 'Response message',
    type: String,
  })
  message: string;
}
