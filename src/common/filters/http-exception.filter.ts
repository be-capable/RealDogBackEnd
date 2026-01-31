import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggingFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const url = (req as any).originalUrl ?? req.url;
    const hasAuth = typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0;

    const payload = {
      status,
      method: req.method,
      url,
      hasAuth,
    };

    if (status === 401) {
      this.logger.warn(JSON.stringify(payload));
    } else if (status >= 500) {
      this.logger.error(JSON.stringify(payload), exception.stack);
    } else {
      this.logger.warn(JSON.stringify(payload));
    }

    const body = exception.getResponse();
    res.status(status).json(body);
  }
}

