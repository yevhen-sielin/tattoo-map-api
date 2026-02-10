import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global catch-all exception filter.
 *
 * - Logs the full error (including stack trace) server-side in ALL environments.
 * - In production: returns a generic message — never leaks stack traces to clients.
 * - In development: returns full error details for easier debugging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    // Always log full details server-side
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        JSON.stringify(response, null, 2),
      );
    } else {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (this.isProd) {
      // Production: never leak internals
      response.status(status).json({
        statusCode: status,
        message: status >= 500 ? 'Internal server error' : message,
      });
    } else {
      // Development: include full details for debugging
      const detail =
        exception instanceof HttpException
          ? exception.getResponse()
          : exception instanceof Error
            ? {
                name: exception.name,
                message: exception.message,
                stack: exception.stack,
              }
            : { error: String(exception) };

      response.status(status).json({
        statusCode: status,
        message,
        ...(typeof detail === 'object' ? detail : { detail }),
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
