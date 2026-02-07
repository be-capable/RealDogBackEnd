import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    try {
      const authHeader = req.get('authorization');
      
      if (!authHeader) {
        this.logger.warn('No authorization header found');
        throw new UnauthorizedException('No authorization header');
      }

      const accessToken = authHeader.replace('Bearer', '').trim();

      const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token: accessToken },
      });

      if (isBlacklisted) {
        this.logger.warn(`Token is blacklisted for user: ${payload.sub}`);
        throw new UnauthorizedException('Token is invalidated');
      }

      this.logger.log(`Token validated successfully for user: ${payload.sub}`);
      return { userId: payload.sub, email: payload.email };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
