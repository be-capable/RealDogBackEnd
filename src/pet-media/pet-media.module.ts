import { Module } from '@nestjs/common';
import { PetMediaService } from './pet-media.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PetMediaController } from './pet-media.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PetMediaController],
  providers: [PetMediaService],
  exports: [PetMediaService],
})
export class PetMediaModule {}
