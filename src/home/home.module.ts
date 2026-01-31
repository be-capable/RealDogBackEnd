import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DogEventsModule } from '../dog-events/dog-events.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [PrismaModule, DogEventsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}

