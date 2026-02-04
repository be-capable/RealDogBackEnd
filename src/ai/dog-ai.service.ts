import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ASR_PROVIDER, LLM_PROVIDER, TTS_PROVIDER } from './providers/provider.tokens';
import { AsrProvider, LlmProvider, TtsProvider } from './providers/provider.types';
import { S3Service } from '../s3/s3.service';

type DogInterpretResult = {
  meaningText: string;
  dogEventType?: 'BARK' | 'HOWL' | 'WHINE' | 'GROWL' | 'OTHER';
  confidence?: number;
  stateType?: string;
  contextType?: string;
};

type DogSynthesizePlan = {
  barkType: 'BARK' | 'HOWL' | 'WHINE' | 'GROWL' | 'OTHER';
  intensity: number;
  dogText: string;
  transcript?: string;
};

@Injectable()
export class DogAiService {
  private readonly logger = new Logger(DogAiService.name);
  private readonly dogAudioOutputMode: 'synthetic' | 'volc_tts';
  private readonly aiDebugLog: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    @Inject(ASR_PROVIDER) private readonly asrProvider: AsrProvider,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    @Inject(TTS_PROVIDER) private readonly ttsProvider: TtsProvider,
  ) {
    const mode = (process.env.DOG_AUDIO_OUTPUT_MODE ?? 'synthetic').trim();
    this.dogAudioOutputMode = mode === 'volc_tts' ? 'volc_tts' : 'synthetic';
    const defaultDebug = process.env.NODE_ENV === 'production' ? 'false' : 'true';
    this.aiDebugLog = (process.env.AI_DEBUG_LOG ?? defaultDebug) === 'true';
  }

  /**
   * Interprets a dog's vocalization from an audio file.
   *
   * 1. Saves the audio file.
   * 2. Sends it to the AI model (Gemini/GPT-4o) for multimodal analysis.
   * 3. Parses the AI response to get meaning, emotion, and confidence.
   * 4. Persists the event in the database.
   *
   * @param params - Contains petId, locale, context, and the audio file.
   * @returns The interpretation result including translated text and emotion labels.
   */
  async interpretDogAudio(params: {
    userId: number;
    petId: number;
    locale?: string;
    context?: string;
    audio: Express.Multer.File;
  }) {
    const traceId = randomUUID();
    this.debugLog({
      msg: 'dog.interpret.start',
      traceId,
      userId: params.userId,
      petId: params.petId,
      locale: params.locale,
      audio: { mimetype: params.audio?.mimetype, size: params.audio?.size, originalname: params.audio?.originalname },
    });
    const pet = await this.assertPetOwnership(params.userId, params.petId);
    const { format, ext } = this.requireSupportedAudio(params.audio);

    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    const inputKey = this.s3Service.generateAudioKey(params.petId, ext, 'interpret');
    const { url: inputAudioUrl } = await this.s3Service.upload(params.audio.buffer, inputKey, params.audio.mimetype);
    this.debugLog({ msg: 'dog.interpret.saved_input', traceId, inputAudioUrl, audioFormat: format });

    const t0 = Date.now();
    let transcript = '';
    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    let result: DogInterpretResult = {
      meaningText:
        lang === 'zh-CN'
          ? '我在叫，但我也不太确定我想表达什么。可能是想引起你的注意。'
          : "I'm making noise, but I'm not sure what I mean. Maybe I'm trying to get your attention.",
      dogEventType: 'OTHER',
      confidence: 0.2,
    };
    let resultSource: 'asr_llm' | 'fallback' = 'fallback';
    try {
      this.debugLog({ msg: 'dog.interpret.asr.request', traceId, audioFormat: format, audioBytes: params.audio?.size });
      transcript = await this.aiTranscribeHumanAudio({ traceId, scene: 'dog.interpret', locale: params.locale, file: params.audio });
      this.debugLog({
        msg: 'dog.interpret.asr.result',
        traceId,
        transcriptLen: transcript.length,
        transcriptPreview: transcript.slice(0, 96),
      });
      // if (!transcript.trim()) {
      //   transcript = '[Audio contains non-speech sounds or silence. Please interpret based on context/audio features if possible.]';
      // }
      // if (!transcript.trim()) throw new BadGatewayException('ASR transcript is empty');
      if (!transcript.trim()) {
        this.debugLog({ msg: 'dog.interpret.asr_empty', traceId });
        // Use a fallback prompt for non-speech audio (barking/howling without words)
        transcript = '[Audio contains non-speech sounds or silence. Please interpret based on context/audio features if possible.]';
      }

      this.debugLog({
        msg: 'dog.interpret.llm.request',
        traceId,
        transcriptLen: transcript.length,
        hasContext: Boolean(params.context),
      });
      result = await this.aiInterpretFromTranscript({
        traceId,
        locale: params.locale,
        petName: pet.name,
        breedId: pet.breedId,
        context: params.context,
        transcript,
      });
      resultSource = 'asr_llm';
    } catch (e: any) {
      resultSource = 'fallback';
      this.errorLog(e, { msg: 'dog.interpret.failed', traceId, resultSource });
    } finally {
      this.debugLog({ msg: 'dog.interpret.done', traceId, ms: Date.now() - t0 });
    }

    const eventType = this.normalizeDogEventType(result.dogEventType) ?? 'OTHER';
    const confidence = typeof result.confidence === 'number' ? result.confidence : undefined;
    const meaningTextPreview =
      typeof result.meaningText === 'string' ? result.meaningText.slice(0, 96) : '';
    this.debugLog({
      msg: 'dog.interpret.model_result',
      traceId,
      source: resultSource,
      eventType,
      confidence: confidence ?? null,
      meaningTextLen: typeof result.meaningText === 'string' ? result.meaningText.length : 0,
      meaningTextPreview,
    });

    let outputAudioUrl: string | null = null;
    try {
      const out = await this.ttsProvider.synthesize({
        text: result.meaningText,
        locale: params.locale,
        uid: String(params.userId),
        traceId,
      });
      const outputKey = this.s3Service.generateAudioKey(params.petId, out.ext, 'tts-output');
      const { url } = await this.s3Service.upload(Buffer.from(out.bytes), outputKey, 'audio/wav');
      outputAudioUrl = url;
      this.debugLog({ msg: 'dog.interpret.tts.saved', traceId, outputAudioUrl, ext: out.ext });
    } catch (e: any) {
      this.errorLog(e, { msg: 'dog.interpret.tts_failed', traceId });
      outputAudioUrl = null;
    }

    const ev = await this.prisma.dogEvent.create({
      data: {
        petId: params.petId,
        mode: 'DOG_TO_HUMAN',
        eventType,
        stateType: result.stateType ?? null,
        contextType: result.contextType ?? null,
        confidence,
        audioUrl: inputAudioUrl,
        outputAudioUrl,
        meaningText: result.meaningText,
        inputTranscript: transcript || null,
      },
    });
    this.debugLog({ msg: 'dog.interpret.persisted', traceId, eventId: ev.id, eventType, confidence });

    return {
      eventId: ev.id,
      inputAudioUrl,
      outputAudioUrl,
      meaningText: result.meaningText,
      transcript: transcript || null,
      labels: {
        dogEventType: eventType,
        stateType: result.stateType ?? null,
        contextType: result.contextType ?? null,
      },
      confidence: confidence ?? null,
      modelVersion: {
        source: resultSource,
        asr: resultSource === 'asr_llm' ? 'volcengine' : null,
        llm: resultSource === 'asr_llm' ? 'ark' : null,
        tts: outputAudioUrl ? 'volcengine' : null,
      },
      debug: this.aiDebugLog
        ? {
            traceId,
            source: resultSource,
          }
        : null,
    };
  }

  /**
   * Synchronously synthesizes dog audio from human speech.
   * Warning: This may timeout for long inputs. Use `createSynthesizeTask` instead.
   *
   * 1. Transcribes user audio (STT).
   * 2. Plans the dog response (Logic/Planning).
   * 3. Generates dog audio (TTS/Synth).
   *
   * @param params - User input details.
   * @returns URLs for input and output audio.
   */
  async synthesizeDogAudio(params: {
    userId: number;
    petId: number;
    locale?: string;
    style?: string;
    audio: Express.Multer.File;
  }) {
    const traceId = randomUUID();
    this.debugLog({
      msg: 'dog.synthesize.start',
      traceId,
      userId: params.userId,
      petId: params.petId,
      locale: params.locale,
      style: params.style,
      audio: { mimetype: params.audio?.mimetype, size: params.audio?.size, originalname: params.audio?.originalname },
    });
    await this.assertPetOwnership(params.userId, params.petId);

    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    // 1. Save input audio
    const { format, ext: inputExt } = this.requireSupportedAudio(params.audio);
    const inputKey = this.s3Service.generateAudioKey(params.petId, inputExt, 'synthesize-input');
    const { url: inputAudioUrl } = await this.s3Service.upload(params.audio.buffer, inputKey, params.audio.mimetype);
    this.debugLog({ msg: 'dog.synthesize.saved_input', traceId, inputAudioUrl });

    // 2. ASR -> LLM plan
    const t1 = Date.now();
    let plan: DogSynthesizePlan;
    let planSource: 'ark' | 'fallback' = 'ark';
    try {
      this.debugLog({
        msg: 'dog.synthesize.transcribe.request',
        traceId,
        audioFormat: format,
        audioBytes: params.audio?.size,
      });
      let transcript = await this.aiTranscribeHumanAudio({
        traceId,
        scene: 'dog.synthesize',
        locale: params.locale,
        file: params.audio,
      });
      this.debugLog({
        msg: 'dog.synthesize.transcribe.result',
        traceId,
        transcriptLen: transcript.length,
        transcriptPreview: transcript.slice(0, 96),
      });

      if (!transcript.trim()) {
        this.debugLog({ msg: 'dog.synthesize.asr_empty', traceId });
        transcript = 'Hello';
      }

      plan = await this.aiPlanBarkFromTranscript({
        traceId,
        locale: params.locale,
        style: params.style,
        transcript,
      });
      planSource = 'ark';
    } finally {
      this.debugLog({
        msg: 'dog.synthesize.plan_done',
        traceId,
        ms: Date.now() - t1,
        planSource,
      });
    }
    this.debugLog({
      msg: 'dog.synthesize.plan_result',
      traceId,
      planSource,
      barkType: plan.barkType,
      intensity: plan.intensity,
      transcriptLen: typeof plan.transcript === 'string' ? plan.transcript.length : 0,
      transcriptPreview: typeof plan.transcript === 'string' ? plan.transcript.slice(0, 96) : '',
      dogTextLen: typeof plan.dogText === 'string' ? plan.dogText.length : 0,
      dogTextPreview: typeof plan.dogText === 'string' ? plan.dogText.slice(0, 96) : '',
    });

    // 3. TTS (with fallback to synthetic)
    const t2 = Date.now();
    let outputBytes: Uint8Array;
    let ext: string;
    try {
      this.debugLog({
        msg: 'dog.synthesize.tts.request',
        traceId,
        outputMode: this.dogAudioOutputMode,
        barkType: plan.barkType,
        intensity: plan.intensity,
        dogTextLen: typeof plan.dogText === 'string' ? plan.dogText.length : 0,
      });
      const out = await this.aiTextToSpeechDogLike({
        locale: params.locale,
        dogText: plan.dogText,
        barkType: plan.barkType,
        intensity: plan.intensity,
      });
      outputBytes = out.bytes;
      ext = out.ext;
    } catch (e: any) {
      this.errorLog(e, { msg: 'dog.synthesize.tts_failed', traceId, outputMode: this.dogAudioOutputMode });
      throw e;
    } finally {
      this.debugLog({ msg: 'dog.synthesize.tts_done', traceId, ms: Date.now() - t2, outputMode: this.dogAudioOutputMode });
    }

    const outputKey = this.s3Service.generateAudioKey(params.petId, ext, 'synthesize-output');
    const { url: outputAudioUrl } = await this.s3Service.upload(Buffer.from(outputBytes), outputKey, 'audio/wav');
    this.debugLog({ msg: 'dog.synthesize.saved_output', traceId, outputAudioUrl, ext });

    const ev = await this.prisma.dogEvent.create({
      data: {
        petId: params.petId,
        mode: 'HUMAN_TO_DOG',
        eventType: plan.barkType,
        confidence: plan.intensity,
        audioUrl: inputAudioUrl,
        outputAudioUrl,
        inputTranscript: plan.transcript ?? '',
      },
    });

    this.debugLog({ msg: 'dog.synthesize.persisted', traceId, eventId: ev.id, barkType: plan.barkType, intensity: plan.intensity });

    return {
      eventId: ev.id,
      inputAudioUrl,
      outputAudioUrl,
      labels: {
        dogEventType: plan.barkType,
      },
      modelVersion: {
        plan: planSource,
        tts: this.dogAudioOutputMode === 'volc_tts' ? 'volcengine' : 'synthetic',
      },
    };
  }

  /**
   * Creates an asynchronous task for synthesizing dog audio.
   * Recommended for production to avoid timeouts.
   *
   * @returns An object containing the `taskId` to poll.
   */
  async createSynthesizeTask(params: {
    userId: number;
    petId: number;
    locale?: string;
    style?: string;
    audio: Express.Multer.File;
  }) {
    const traceId = randomUUID();
    this.debugLog({
      msg: 'task.create.start',
      traceId,
      userId: params.userId,
      petId: params.petId,
      locale: params.locale,
      style: params.style,
      audio: { mimetype: params.audio?.mimetype, size: params.audio?.size, originalname: params.audio?.originalname },
    });
    await this.assertPetOwnership(params.userId, params.petId);

    if (!this.s3Service.isConfigured()) {
      throw new ServiceUnavailableException('Storage not configured');
    }

    // Save file immediately
    const { format, ext: inputExt } = this.requireSupportedAudio(params.audio);
    const inputKey = this.s3Service.generateAudioKey(params.petId, inputExt, 'task-input');
    const { url: inputAudioUrl } = await this.s3Service.upload(params.audio.buffer, inputKey, params.audio.mimetype);

    // Create Task
    const task = await this.prisma.dogTask.create({
      data: {
        id: randomUUID(),
        userId: params.userId,
        petId: params.petId,
        type: 'SYNTHESIZE',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    this.debugLog({
      msg: 'task.create.saved_input',
      traceId,
      taskId: task.id,
      inputAudioUrl,
      audioFormat: format,
    });

    // Start background process (Fire and Forget)
    // Using setImmediate to detach from the current tick slightly
    setImmediate(() => {
      this.processSynthesizeTask(task.id, {
        audioBase64: params.audio.buffer.toString('base64'),
        audioFormat: format,
        locale: params.locale,
        style: params.style,
        inputAudioUrl,
      }).catch(err => {
        this.errorLog(err, `Task ${task.id} failed in background`);
      });
    });

    return { taskId: task.id };
  }

  /**
   * Retrieves the status and result of a background task.
   */
  async getTaskStatus(userId: number, taskId: string) {
    const task = await this.prisma.dogTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Forbidden');

    let result = null;
    if (task.result) {
      try {
        result = JSON.parse(task.result);
      } catch {}
    }

    return {
      id: task.id,
      status: task.status,
      result,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private async processSynthesizeTask(taskId: string, params: {
    audioBase64: string;
    audioFormat: 'wav' | 'mp3';
    locale?: string;
    style?: string;
    inputAudioUrl: string;
  }) {
    const traceId = `task-${taskId}`;
    this.debugLog({
      msg: 'task.process.start',
      traceId,
      taskId,
      inputAudioUrl: params.inputAudioUrl,
      audioFormat: params.audioFormat,
      audioBase64Len: typeof params.audioBase64 === 'string' ? params.audioBase64.length : 0,
      audioBytesApprox: typeof params.audioBase64 === 'string' ? Math.floor((params.audioBase64.length * 3) / 4) : 0,
    });

    try {
      await this.prisma.dogTask.update({
        where: { id: taskId },
        data: { status: 'PROCESSING', error: null },
      });
      // 1. Plan
      const t1 = Date.now();
      let plan: DogSynthesizePlan;
      try {
        this.debugLog({
          msg: 'task.transcribe.request',
          traceId,
        });
        const fileBytes = Buffer.from(params.audioBase64, 'base64');
        const ext = params.audioFormat === 'mp3' ? 'mp3' : 'wav';
let transcript = await this.aiTranscribeHumanAudio({
          traceId,
          scene: 'task.transcribe',
          locale: params.locale,
          file: { buffer: fileBytes, mimetype: '', originalname: `input.${ext}` } as any,
        });
        this.debugLog({
          msg: 'task.transcribe.result',
          traceId,
          transcriptLen: transcript.length,
          transcriptPreview: transcript.slice(0, 96),
        });
        plan = await this.aiPlanBarkFromTranscript({
          traceId,
          locale: params.locale,
          style: params.style,
          transcript,
        });
      } catch (e: any) {
        this.errorLog(e, { msg: 'task.plan_failed_fallback', taskId });
        plan = {
          barkType: 'OTHER',
          intensity: 0.6,
          dogText: params.locale?.startsWith('zh') ? '汪汪！' : 'Woof!',
          transcript: '',
        };
      }
      this.debugLog({ msg: 'task.plan_done', traceId, ms: Date.now() - t1 });
      this.debugLog({
        msg: 'task.plan_result',
        traceId,
        barkType: plan.barkType,
        intensity: plan.intensity,
        transcriptLen: typeof plan.transcript === 'string' ? plan.transcript.length : 0,
        transcriptPreview: typeof plan.transcript === 'string' ? plan.transcript.slice(0, 96) : '',
        dogTextLen: typeof plan.dogText === 'string' ? plan.dogText.length : 0,
        dogTextPreview: typeof plan.dogText === 'string' ? plan.dogText.slice(0, 96) : '',
      });

      // 2. TTS
      const t2 = Date.now();
      const out = await this.aiTextToSpeechDogLike({
        locale: params.locale,
        dogText: plan.dogText,
        barkType: plan.barkType,
        intensity: plan.intensity,
      });
      this.debugLog({
        msg: 'task.tts_done',
        traceId,
        ms: Date.now() - t2,
        outputMode: this.dogAudioOutputMode,
        outputBytes: out.bytes?.length ?? 0,
        ext: out.ext,
      });

      // 3. Save
      const task = await this.prisma.dogTask.findUnique({ where: { id: taskId } });
      if (!task) return; // Should not happen

      const outputKey = this.s3Service.generateAudioKey(task.petId, out.ext, 'task-output');
      const { url: outputAudioUrl } = await this.s3Service.upload(Buffer.from(out.bytes), outputKey, 'audio/wav');

      // 4. Create Event
      const ev = await this.prisma.dogEvent.create({
        data: {
          petId: task.petId,
          mode: 'HUMAN_TO_DOG',
          eventType: plan.barkType,
          confidence: plan.intensity,
          audioUrl: params.inputAudioUrl,
          outputAudioUrl,
          inputTranscript: plan.transcript ?? '',
        },
      });

      const result = {
        eventId: ev.id,
        inputAudioUrl: params.inputAudioUrl,
        outputAudioUrl,
        labels: {
          dogEventType: plan.barkType,
        },
        modelVersion: {
          plan: 'ark',
          tts: this.dogAudioOutputMode === 'volc_tts' ? 'volcengine' : 'synthetic',
        },
      };

      await this.prisma.dogTask.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          result: JSON.stringify(result),
        },
      });
      this.debugLog({ msg: 'task.completed', taskId });

    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await this.prisma.dogTask.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          error: msg,
        },
      });
      this.errorLog(e, { msg: 'task.failed', taskId });
    }
  }

  private async assertPetOwnership(userId: number, petId: number) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, ownerId: true, name: true, breedId: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.ownerId !== userId) throw new ForbiddenException('Forbidden');
    return pet;
  }

  private requireSupportedAudio(file: Express.Multer.File): { format: 'wav' | 'mp3'; ext: string } {
    const mime = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();
    if (mime.includes('wav') || name.endsWith('.wav')) return { format: 'wav', ext: 'wav' };
    if (mime.includes('mpeg') || name.endsWith('.mp3')) return { format: 'mp3', ext: 'mp3' };
    throw new BadRequestException('Unsupported audio format. Please upload wav or mp3.');
  }

  private async aiInterpretFromTranscript(params: {
    traceId?: string;
    locale?: string;
    petName?: string;
    breedId?: string;
    context?: string;
    transcript: string;
  }): Promise<DogInterpretResult> {
    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    const system =
      lang === 'zh-CN'
        ? [
            '你是 RealDog 的“狗语翻译官”。',
            '输入包含：ASR 转写文本（可能是狗叫的拟声/乱码）、宠物信息、用户场景补充。',
            '你需要基于这些信息生成拟人化解释。',
            '只输出 JSON，不要 markdown。',
            'JSON schema: {"meaningText":string,"dogEventType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","stateType":string|null,"contextType":string|null,"confidence":number}',
            'confidence 取 0~1。',
          ].join('\n')
        : [
            'You are RealDog "Dog Translator".',
            'Input includes an ASR transcript (may be noisy), pet context, and optional user context.',
            'You must generate a humanized interpretation.',
            'Output JSON only.',
            'JSON schema: {"meaningText":string,"dogEventType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","stateType":string|null,"contextType":string|null,"confidence":number}',
            'confidence is 0~1.',
          ].join('\n');

    const user =
      lang === 'zh-CN'
        ? [
            params.petName || params.breedId ? `宠物信息：name=${params.petName ?? ''}, breedId=${params.breedId ?? ''}` : '',
            params.context ? `用户场景补充：${params.context}` : '',
            `ASR 文本：${params.transcript || ''}`,
          ]
            .filter((x) => x.length > 0)
            .join('\n')
        : [
            params.petName || params.breedId ? `Pet context: name=${params.petName ?? ''}, breedId=${params.breedId ?? ''}` : '',
            params.context ? `User context: ${params.context}` : '',
            `ASR transcript: ${params.transcript || ''}`,
          ]
            .filter((x) => x.length > 0)
            .join('\n');

    const t0 = Date.now();
    this.debugLog({
      msg: 'llm.interpret.request',
      traceId: params.traceId ?? null,
      locale: params.locale ?? null,
      transcriptLen: params.transcript.length,
      hasContext: Boolean(params.context),
    });
    const res = await this.llmProvider.chat({
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    this.debugLog({
      msg: 'llm.interpret.response',
      traceId: params.traceId ?? null,
      ms: Date.now() - t0,
      vendor: res.vendor,
      model: res.model,
      contentLen: typeof res.content === 'string' ? res.content.length : 0,
      contentPreview: typeof res.content === 'string' ? res.content.slice(0, 240) : '',
    });

    const content = res.content;
    if (!content) throw new BadGatewayException('AI response is empty');
    const parsed = this.tryParseJson(content);
    if (!parsed) throw new BadGatewayException('AI response is not JSON');

    const meaningText = typeof parsed.meaningText === 'string' ? parsed.meaningText : '';
    if (!meaningText.trim()) throw new BadGatewayException('AI meaningText is empty');

    const out = {
      meaningText: meaningText.trim(),
      dogEventType: this.normalizeDogEventType(parsed.dogEventType) ?? 'OTHER',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      stateType: typeof parsed.stateType === 'string' ? parsed.stateType : undefined,
      contextType: typeof parsed.contextType === 'string' ? parsed.contextType : undefined,
    };
    this.debugLog({
      msg: 'llm.interpret.parsed',
      traceId: params.traceId ?? null,
      dogEventType: out.dogEventType,
      confidence: typeof out.confidence === 'number' ? out.confidence : null,
      meaningTextLen: out.meaningText.length,
      meaningTextPreview: out.meaningText.slice(0, 120),
      stateType: out.stateType ?? null,
      contextType: out.contextType ?? null,
    });
    return out;
  }

  private async aiTextToSpeechDogLike(params: {
    locale?: string;
    dogText: string;
    barkType: DogSynthesizePlan['barkType'];
    intensity: number;
  }): Promise<{ bytes: Uint8Array; ext: string }> {
    if (this.dogAudioOutputMode === 'synthetic') {
      return { bytes: this.synthDogWav(params.barkType, params.intensity), ext: 'wav' };
    }
    if (this.dogAudioOutputMode === 'volc_tts') {
      const out = await this.ttsProvider.synthesize({
        text: params.dogText,
        locale: params.locale,
      });
      return { bytes: out.bytes, ext: out.ext };
    }
    return { bytes: this.synthDogWav(params.barkType, params.intensity), ext: 'wav' };
  }

  private synthDogWav(barkType: DogSynthesizePlan['barkType'], intensity: number): Uint8Array {
    const sr = 22050;
    const dur =
      barkType === 'HOWL' ? 1.2 : barkType === 'WHINE' ? 0.9 : barkType === 'GROWL' ? 0.8 : 0.6;
    const n = Math.max(1, Math.floor(sr * dur));
    const out = new Int16Array(n);
    const amp = Math.max(0.1, Math.min(1, intensity));

    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const r = t / dur;
      let env = 1;
      if (barkType === 'HOWL') {
        env = Math.sin(Math.min(Math.PI, r * Math.PI));
      } else if (barkType === 'WHINE') {
        env = Math.sin(Math.min(Math.PI, r * Math.PI));
      } else if (barkType === 'GROWL') {
        env = Math.exp(-t * 1.8);
      } else {
        env = Math.exp(-t * 6.0);
      }

      let f = 500;
      if (barkType === 'HOWL') f = 220 + 80 * Math.sin(2 * Math.PI * t * 0.8);
      if (barkType === 'WHINE') f = 850 + 300 * Math.sin(2 * Math.PI * t * 2.2);
      if (barkType === 'GROWL') f = 120 + 40 * Math.sin(2 * Math.PI * t * 1.2);
      if (barkType === 'BARK') f = 520 - 220 * r;

      const sine = Math.sin(2 * Math.PI * f * t);
      const noise = (Math.random() * 2 - 1) * (barkType === 'GROWL' ? 0.35 : 0.15);
      const y = (sine + noise) * env * amp;
      const s = Math.max(-1, Math.min(1, y));
      out[i] = Math.floor(s * 32767);
    }

    return this.encodeWavPcm16(out, sr);
  }

  private encodeWavPcm16(samples: Int16Array, sampleRate: number): Uint8Array {
    const dataLen = samples.length * 2;
    const buf = new ArrayBuffer(44 + dataLen);
    const view = new DataView(buf);
    const writeStr = (offset: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataLen, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset, samples[i], true);
      offset += 2;
    }
    return new Uint8Array(buf);
  }

  private async aiTranscribeHumanAudio(params: {
    traceId?: string;
    scene?: string;
    locale?: string;
    file: Express.Multer.File;
  }): Promise<string> {
    const { format } = this.requireSupportedAudio(params.file);
    const t0 = Date.now();
    const res = await this.asrProvider.transcribe({
      audioBytes: params.file.buffer,
      format,
      locale: params.locale,
    });
    const text = typeof res?.text === 'string' ? res.text : '';
    this.debugLog({
      msg: 'asr.transcribe.response',
      traceId: params.traceId ?? null,
      scene: params.scene ?? null,
      ms: Date.now() - t0,
      vendor: (res as any)?.vendor ?? null,
      model: (res as any)?.model ?? null,
      textLen: text.length,
      textPreview: text.slice(0, 120),
    });
    // if (!text.trim()) throw new BadGatewayException('ASR transcript is empty');
    // if (!text.trim()) throw new BadGatewayException('ASR transcript is empty');
    return text.trim();
  }

  private async aiPlanBarkFromTranscript(params: {
    traceId?: string;
    locale?: string;
    style?: string;
    transcript: string;
  }): Promise<DogSynthesizePlan> {
    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    const system =
      lang === 'zh-CN'
        ? [
            '你是 RealDog 的“人话→狗叫规划器”。',
            '输入是用户说的话 transcript（已经是文本），你需要生成狗能理解的“发声计划”。',
            '只输出 JSON，不要 markdown。',
            'JSON schema: {"transcript": string, "barkType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","intensity":number,"dogText":string}',
            'intensity 取 0~1，小数。',
            'dogText 用于生成“狗叫音频”的提示词，应该像狗叫（短、拟声、带情绪）。',
          ].join('\n')
        : [
            'You are RealDog human-to-dog vocalization planner.',
            'Input is a transcript (text). You must generate a dog vocalization plan.',
            'Output JSON only, no markdown.',
            'JSON schema: {"transcript": string, "barkType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","intensity":number,"dogText":string}',
            'intensity is 0~1 float. dogText should be short onomatopoeia with emotion.',
          ].join('\n');

    const user =
      lang === 'zh-CN'
        ? `风格：${params.style ?? 'default'}\ntranscript：${params.transcript}`
        : `Style: ${params.style ?? 'default'}\ntranscript: ${params.transcript}`;

    const t0 = Date.now();
    this.debugLog({
      msg: 'llm.plan.request',
      traceId: params.traceId ?? null,
      locale: params.locale ?? null,
      style: params.style ?? null,
      transcriptLen: params.transcript.length,
    });
    const res = await this.llmProvider.chat({
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    this.debugLog({
      msg: 'llm.plan.response',
      traceId: params.traceId ?? null,
      ms: Date.now() - t0,
      vendor: res.vendor,
      model: res.model,
      contentLen: typeof res.content === 'string' ? res.content.length : 0,
      contentPreview: typeof res.content === 'string' ? res.content.slice(0, 240) : '',
    });
    const content = res.content;
    if (!content) throw new BadGatewayException('AI response is empty');
    const parsed = this.tryParseJson(content);
    if (!parsed) throw new BadGatewayException('AI response is not JSON');

    const barkType = this.normalizeDogEventType(parsed.barkType) ?? 'OTHER';
    const intensity = typeof parsed.intensity === 'number' ? parsed.intensity : 0.6;
    const dogText = typeof parsed.dogText === 'string' ? parsed.dogText : 'Woof!';
    const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : params.transcript;

    const out = {
      barkType,
      intensity: Math.max(0, Math.min(1, intensity)),
      dogText: dogText.trim() || 'Woof!',
      transcript,
    };
    this.debugLog({
      msg: 'llm.plan.parsed',
      traceId: params.traceId ?? null,
      barkType: out.barkType,
      intensity: out.intensity,
      dogTextLen: out.dogText.length,
      dogTextPreview: out.dogText.slice(0, 120),
    });
    return out;
  }

  private debugLog(obj: any) {
    if (!this.aiDebugLog) return;
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    this.logger.log(s);
  }

  private errorLog(err: any, ctx: any) {
    const s = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
    this.logger.error(s, err?.stack ?? err?.message ?? String(err));
  }

  private normalizeDogEventType(v: any): DogInterpretResult['dogEventType'] | null {
    const x = typeof v === 'string' ? v.toUpperCase() : '';
    if (x === 'BARK' || x === 'HOWL' || x === 'WHINE' || x === 'GROWL' || x === 'OTHER') return x as any;
    return null;
  }

  private tryParseJson(s: string): any | null {
    const trimmed = s.trim();
    // Try to find JSON object structure
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const maybe = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
}
