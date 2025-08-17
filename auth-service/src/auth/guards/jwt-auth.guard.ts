import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest();
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = this.getRequest(context);
    
    // Extract token from cookie if not in Authorization header
    if (!user && request.cookies?.auth_token) {
      // The JWT strategy will handle token validation
      return user;
    }

    return super.handleRequest(err, user, info, context);
  }
}