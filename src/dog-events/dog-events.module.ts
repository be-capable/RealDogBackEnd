import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DogEventsService } from './dog-events.service';
import { PetEventsController } from './pet-events.controller';
import { EventsController } from './events.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PetEventsController, EventsController],
  providers: [DogEventsService],
  exports: [DogEventsService],
})
export class DogEventsModule {}
