import { Module } from '@nestjs/common';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';
import { DogAiController } from './dog-ai.controller';
import { DogAiService } from './dog-ai.service';

@Module({
  controllers: [DialogueController, DogAiController],
  providers: [DialogueService, DogAiService],
})
export class AiModule {}
