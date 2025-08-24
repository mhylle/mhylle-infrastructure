import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Res, 
  Req, 
  UseGuards,
  UnauthorizedException 
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    
    // Set HTTP-only cookie for SSO
    const cookieOptions: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };
    
    // Only set domain in production, not for localhost development
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.domain = process.env.COOKIE_DOMAIN || '.mhylle.com';
    }
    
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
    const clearCookieOptions: any = {};
    
    // Only set domain in production, not for localhost development
    if (process.env.NODE_ENV === 'production') {
      clearCookieOptions.domain = process.env.COOKIE_DOMAIN || '.mhylle.com';
    }
    
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
