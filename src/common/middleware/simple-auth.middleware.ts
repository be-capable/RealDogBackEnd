import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SimpleAuthMiddleware implements NestMiddleware {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for public routes
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

    const token = authHeader.split(' ')[1];
    
    // DEBUG logs
    console.log(`[Middleware] Verifying token: ${token.substring(0, 10)}...`);

    try {
      const decoded: any = this.jwtService.verify(token);
      console.log(`[Middleware] Verification SUCCESS. User: ${JSON.stringify(decoded)}`);
      
      // Map 'sub' to 'userId' to match what controllers expect
      const user = {
        ...decoded,
        userId: decoded.sub || decoded.userId || decoded.id
      };
      (req as any).user = user;
      next();
    } catch (error) {
      console.error(`[Middleware] Verification FAILED: ${error.message}`);
      
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    }
  }
}
