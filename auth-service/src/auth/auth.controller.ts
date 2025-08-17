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
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);
    
    // Set HTTP-only cookie for SSO
    response.cookie('auth_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      domain: process.env.COOKIE_DOMAIN || '.mhylle.com',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return {
      success: true,
      data: result.user,
    };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('auth_token', {
      domain: process.env.COOKIE_DOMAIN || '.mhylle.com',
    });

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

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions: {
          apps: user.apps,
          roles: user.roles,
        },
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
