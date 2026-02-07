import { Module } from '@nestjs/common';
import { PetMediaService } from './pet-media.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PetMediaController } from './pet-media.controller';
import { I18nService } from '../i18n/i18n.service';

@Module({
  imports: [PrismaModule],
  controllers: [PetMediaController],
  providers: [PetMediaService, I18nService],
  exports: [PetMediaService],
})
export class PetMediaModule {}
