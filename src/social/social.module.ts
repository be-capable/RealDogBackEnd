import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPostService } from './services/social-post.service';
import { InteractionService } from './services/interaction.service';
import { RelationshipService } from './services/relationship.service';
import { NotificationService } from './services/notification.service';
import { SocialController } from './controllers/social.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationGateway } from './gateways/notification.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SocialController],
  providers: [
    PrismaService,
    SocialPostService,
    InteractionService,
    RelationshipService,
    NotificationService,
    NotificationGateway,
  ],
  exports: [
    SocialPostService,
    InteractionService,
    RelationshipService,
    NotificationService,
  ],
})
export class SocialModule {}