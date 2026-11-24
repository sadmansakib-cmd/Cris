import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';

export interface StandardResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
  };
}

/**
 * Wraps every successful controller return value in a consistent envelope.
 * Bypasses payloads that already look like a standard envelope, streamed
 * responses, or empty bodies (204 No Content).
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T> | T>
{
  intercept(
    ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T> | T> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (res.statusCode === 204 || data === undefined || data === null) {
          return data as T;
        }
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>) &&
          'meta' in (data as Record<string, unknown>)
        ) {
          return data as T;
        }
        return {
          success: true,
          data,
          meta: {
            requestId: req.id ?? '',
            timestamp: new Date().toISOString(),
            path: req.originalUrl ?? req.url,
          },
        };
      }),
    );
  }
}
