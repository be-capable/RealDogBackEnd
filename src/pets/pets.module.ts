import { Module } from '@nestjs/common';
import { PetsService } from './pets.service';
import { PetsController } from './pets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PetMediaModule } from '../pet-media/pet-media.module';

@Module({
  imports: [PrismaModule, PetMediaModule],
  controllers: [PetsController],
  providers: [PetsService],
})
export class PetsModule {}
