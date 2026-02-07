import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DogEventsService } from './dog-events.service';
import { PetEventsController } from './pet-events.controller';
import { EventsController } from './events.controller';
import { I18nService } from '../i18n/i18n.service';

@Module({
  imports: [PrismaModule],
  controllers: [PetEventsController, EventsController],
  providers: [DogEventsService, I18nService],
  exports: [DogEventsService],
})
export class DogEventsModule {}
