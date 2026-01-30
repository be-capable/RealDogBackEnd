import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super_secret_key',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const accessToken = req.get('authorization')?.replace('Bearer', '').trim();

    if (!accessToken) {
      throw new UnauthorizedException();
    }

    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { token: accessToken },
    });

    if (isBlacklisted) {
      throw new UnauthorizedException('Token is invalidated');
    }

    return { userId: payload.sub, email: payload.email };
  }
}
