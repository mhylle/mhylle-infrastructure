import { IsEmail, IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsArray()
  apps?: string[] = [];

  @IsOptional()
  roles?: Record<string, string[]> = {};
}
