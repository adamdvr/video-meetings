import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      request.user = { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
