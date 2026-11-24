import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly strategy: JwtStrategy) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    const token = auth.slice(7);
    const payload = await this.strategy.verify(token);
    req.user = { id: payload.sub };
    return true;
  }
}
