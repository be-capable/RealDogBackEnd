import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from './prisma/prisma.service';
import { PrismaModule } from './prisma/prisma.module';
import { ApiSignGuard } from './common/guards/api-sign.guard';
import { PetsModule } from './pets/pets.module';
import { PetMediaModule } from './pet-media/pet-media.module';
import { DogEventsModule } from './dog-events/dog-events.module';
import { HomeModule } from './home/home.module';
import { DictsModule } from './dicts/dicts.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ApiSignGuard,
    },
  ],
})
export class AppModule {}
