import { Module } from '@nestjs/common';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';
import { DogAiController } from './dog-ai.controller';
import { DogAiService } from './dog-ai.service';
import { ASR_PROVIDER, LLM_PROVIDER, TTS_PROVIDER } from './providers/provider.tokens';
import { ArkLlmProvider } from './providers/ark-llm.provider';
import { VolcengineAsrProvider } from './providers/volcengine-asr.provider';
import { VolcengineTtsProvider } from './providers/volcengine-tts.provider';
import { I18nService } from '../i18n/i18n.service';

@Module({
  controllers: [DialogueController, DogAiController],
  providers: [
    DialogueService,
    DogAiService,
    I18nService,
    ArkLlmProvider,
    VolcengineAsrProvider,
    VolcengineTtsProvider,
    { provide: ASR_PROVIDER, useExisting: VolcengineAsrProvider },
    { provide: LLM_PROVIDER, useExisting: ArkLlmProvider },
    { provide: TTS_PROVIDER, useExisting: VolcengineTtsProvider },
  ],
})
export class AiModule {}
