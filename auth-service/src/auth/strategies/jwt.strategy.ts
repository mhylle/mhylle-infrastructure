import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          return request?.cookies?.auth_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'fallback-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.getUserFromPayload(payload);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}