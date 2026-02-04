import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { AppI18nModule } from './i18n/i18n.module';
import { S3Module } from './s3/s3.module';
import { SocialModule } from './social/social.module';
import { SimpleAuthMiddleware } from './common/middleware/simple-auth.middleware';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: 'realdog_hardcoded_secret_2026',
    }),
    AppI18nModule,
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
