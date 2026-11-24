import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.module';

/**
 * Guard that restricts access to admin-only users.
 * Must be used *after* JwtAuthGuard so that `req.user.id` is set.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, status: true },
    });

    if (!user || !user.isAdmin || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
