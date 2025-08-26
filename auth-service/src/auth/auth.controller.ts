import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Res, 
  Req, 
  UseGuards,
  UnauthorizedException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create the user
    const user = await this.usersService.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: registerDto.password,
      isActive: true,
      apps: ['app1'], // Default app access
      roles: {
        'app1': ['user'] // Default role
      }
    });

    // Return user data without password
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      message: 'User registered successfully',
    };
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    
    // Set HTTP-only cookie for SSO
    const cookieOptions: any = {
      httpOnly: true,
      secure: false, // Set to false since we're using HTTP, not HTTPS
      sameSite: 'lax', // Changed from 'strict' to 'lax' to allow cross-origin requests
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Ensure cookie is available for all paths
    };
    
    // Don't set domain - let the cookie work for the current domain
    // This ensures the cookie is available to all paths on mhylle.com
    
    response.cookie('auth_token', result.access_token, cookieOptions);

    return {
      success: true,
      data: result.user,
      // Include access_token in development for localStorage fallback
      ...(process.env.NODE_ENV === 'development' && { access_token: result.access_token }),
    };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    const clearCookieOptions: any = {
      httpOnly: true,
      secure: false, // Match login settings
      sameSite: 'lax', // Match login settings
      path: '/', // Match login settings
    };
    
    // Don't set domain - match login settings
    
    response.clearCookie('auth_token', clearCookieOptions);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Get('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Req() request: Request) {
    const token = request.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('No authentication token found');
    }

    const user = await this.authService.validateToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // Get user permissions
    const permissions = await this.usersService.getUserPermissions(user.id);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions,
      },
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'auth-service',
    };
  }
}
