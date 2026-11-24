import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Assigns a stable request id to every incoming request and mirrors it back
 * on the response as `x-request-id`. Downstream code reads it via `req.id`.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const id = incoming && /^[a-zA-Z0-9._-]{1,128}$/.test(incoming)
      ? incoming
      : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
