import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: boolean;
  code: number;
  error: string;
  message?: string;
  timestamp: string;
}

@Catch(HttpException)
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggingFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const url = (req as any).originalUrl ?? req.url;

    const payload: ErrorResponse = {
      success: false,
      code: status,
      error: exception.name,
      message: exception.message,
      timestamp: new Date().toISOString(),
    };

    if (status === 401) {
      this.logger.warn(`[401] ${req.method} ${url}`);
    } else if (status >= 500) {
      this.logger.error(`[${status}] ${req.method} ${url}`, exception.stack);
    } else {
      this.logger.warn(`[${status}] ${req.method} ${url}`);
    }

    res.status(status).json(payload);
  }
}

