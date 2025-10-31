import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from './task.enums';

export class UpdateTaskStatusDto {
  @ApiProperty({
    description: 'New task status. When set to "completed", completed_at timestamp is automatically set. When changed from "completed" to any other status, completed_at is cleared.',
    enum: TaskStatus,
    example: TaskStatus.COMPLETED,
  })
  @IsEnum(TaskStatus, {
    message: 'status must be one of: pending, in_progress, completed, cancelled',
  })
  status: TaskStatus;
}
