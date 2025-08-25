import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  @Matches(
    /^(?=.*\d)[a-zA-Z\d]+$/,
    {
      message: 'Password must be at least 6 characters and contain at least one number',
    },
  )
  password: string;

  @IsString()
  confirmPassword: string;
}