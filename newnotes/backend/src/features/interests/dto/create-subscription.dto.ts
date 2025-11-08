import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsEnum(['daily', 'weekly', 'real-time'])
  @IsOptional()
  notificationFrequency?: string;

  @IsBoolean()
  @IsOptional()
  isAutoDetected?: boolean;
}
