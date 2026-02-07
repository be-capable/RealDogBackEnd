import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PetMediaModule } from '../pet-media/pet-media.module';
import { I18nService } from '../i18n/i18n.service';

@Module({
  imports: [PrismaModule, PetMediaModule],
  controllers: [PetsController],
  providers: [PetsService, I18nService],
})
export class PetsModule {}
