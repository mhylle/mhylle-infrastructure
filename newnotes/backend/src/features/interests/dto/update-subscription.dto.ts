import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsEnum(['daily', 'weekly', 'real-time'])
  @IsOptional()
  notificationFrequency?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
