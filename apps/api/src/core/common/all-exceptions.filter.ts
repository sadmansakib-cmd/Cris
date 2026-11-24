import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Consistent error envelope for every failure path. Mirrors the shape of
 * ResponseTransformInterceptor's success envelope so clients can rely on a
 * single response contract.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawObj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

    const message =
      (typeof raw === 'string' && raw) ||
      (typeof rawObj.message === 'string' && (rawObj.message as string)) ||
      (Array.isArray(rawObj.message) ? (rawObj.message as string[]).join('; ') : undefined) ||
      (exception instanceof Error ? exception.message : 'Internal server error');

    const code =
      (typeof rawObj.code === 'string' && (rawObj.code as string)) ||
      (exception instanceof HttpException ? exception.name : 'InternalServerError');

    if (status >= 500) {
      this.logger.error(
        {
          requestId: req.id,
          path: req.url,
          method: req.method,
          err: (exception as Error)?.stack ?? String(exception),
        },
        'unhandled error',
      );
    }

    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        status,
        details: rawObj.details ?? rawObj.errors ?? undefined,
      },
      meta: {
        requestId: req.id ?? '',
        timestamp: new Date().toISOString(),
        path: req.originalUrl ?? req.url,
      },
    });
  }
}
