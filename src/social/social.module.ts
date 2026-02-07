import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialPostService } from './services/social-post.service';
import { InteractionService } from './services/interaction.service';
import { RelationshipService } from './services/relationship.service';
import { NotificationService } from './services/notification.service';
import { AnalyticsService } from './services/analytics.service';
import { SearchService } from './services/search.service';
import { SocialController } from './controllers/social.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationGateway } from './gateways/notification.gateway';
import { UserService } from '../user/user.service';
import { PetsService } from '../pets/pets.service';
import { I18nService } from '../i18n/i18n.service';

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
    AnalyticsService,
    SearchService,
    UserService,
    PetsService,
    NotificationGateway,
    I18nService,
  ],
  exports: [
    SocialPostService,
    InteractionService,
    RelationshipService,
    NotificationService,
    AnalyticsService,
    SearchService,
  ],
})
export class SocialModule {}