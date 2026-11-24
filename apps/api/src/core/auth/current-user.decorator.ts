import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator((_data, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
  if (!req.user?.id) throw new Error('CurrentUser used on unauthenticated route');
  return req.user.id;
});
