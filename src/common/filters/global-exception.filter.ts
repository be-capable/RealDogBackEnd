import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  success: boolean;
  code: number;
  error: string;
  message?: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const url = (req as any).originalUrl ?? req.url;

    let status: number;
    let error: string;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = exception.name;
      message = exception.message;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'InternalServerError';
      message = 'Internal server error';
      this.logger.error(`[500] ${req.method} ${url}`, exception instanceof Error ? exception.stack : undefined);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'InternalServerError';
      message = 'Internal server error';
      this.logger.error(`[500] ${req.method} ${url}`, String(exception));
    }

    const payload: ErrorResponse = {
      success: false,
      code: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    };

    res.status(status).json(payload);
  }
}
