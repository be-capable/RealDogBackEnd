import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { DataRetentionService } from './common/services/data-retention.service';
import { PetsModule } from './pets/pets.module';
import { PetMediaModule } from './pet-media/pet-media.module';
import { DogEventsModule } from './dog-events/dog-events.module';
import { HomeModule } from './home/home.module';
import { DictsModule } from './dicts/dicts.module';
import { AiModule } from './ai/ai.module';
import { I18nModule } from './i18n/i18n.module';
import { S3Module } from './s3/s3.module';
import { SocialModule } from './social/social.module';
import { SimpleAuthMiddleware } from './common/middleware/simple-auth.middleware';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'change_this_to_secure_secret',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    I18nModule,
    S3Module,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    UsersModule,
    AuthModule,
    PrismaModule,
    PetsModule,
    PetMediaModule,
    DogEventsModule,
    HomeModule,
    DictsModule,
    AiModule,
    SocialModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    DataRetentionService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SimpleAuthMiddleware)
      .forRoutes('*');
  }
}
