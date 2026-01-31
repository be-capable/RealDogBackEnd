import { Module } from '@nestjs/common';
import { PetMediaService } from './pet-media.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PetMediaService],
  exports: [PetMediaService],
})
export class PetMediaModule {}
