import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SimpleAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const path = req.originalUrl.split('?')[0];
    
    if (
      path.startsWith('/api/auth/login') ||
      path.startsWith('/api/auth/register') ||
      path.startsWith('/api/auth/forgot-password') ||
      path.startsWith('/api/auth/verify-otp') ||
      path.startsWith('/api/auth/reset-password') ||
      path.startsWith('/api/dicts')
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        message: 'Token missing',
        code: 'TOKEN_MISSING'
      });
    }

    next();
  }
}
