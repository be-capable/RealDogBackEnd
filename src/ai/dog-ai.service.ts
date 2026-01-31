import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

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
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  private readonly textModel: string;
  private readonly audioModel: string;
  private readonly transcribeModel: string;
  private readonly ttsModel: string;
  private readonly dogAudioOutputMode: 'openai_tts' | 'synthetic';
  private readonly aiDebugLog: boolean;

  constructor(private readonly prisma: PrismaService) {
    const rawApiBase = process.env.AI_API_BASE ?? process.env.GEMINI3_API_BASE ?? 'https://api.openai.com/v1';
    const normalizedApiBase = String(rawApiBase)
      .trim()
      .replace(/`/g, '')
      .replace(/^"+|"+$/g, '')
      .replace(/^'+|'+$/g, '')
      .replace(/\/$/, '');
    this.apiBaseUrl = normalizedApiBase;
    this.apiKey = process.env.AI_API_KEY ?? process.env.GEMINI3_API_KEY;
    this.textModel = process.env.AI_TEXT_MODEL ?? process.env.GEMINI3_MODEL ?? 'gpt-4o-mini';
    this.audioModel = process.env.AI_AUDIO_MODEL ?? 'gpt-audio';
    this.transcribeModel = process.env.AI_TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe';
    this.ttsModel = process.env.AI_TTS_MODEL ?? 'gpt-4o-mini-tts';
    
    // Default to synthetic if TTS fails or as configured, but we try to use the API if possible
    this.dogAudioOutputMode = (process.env.DOG_AUDIO_OUTPUT_MODE ?? 'synthetic') === 'synthetic' ? 'synthetic' : 'openai_tts';
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
    const inputAudioUrl = this.saveUploadedFile('uploads/dog-audio-input', params.audio, ext);
    this.debugLog({ msg: 'dog.interpret.saved_input', traceId, inputAudioUrl, audioFormat: format });

    const t0 = Date.now();
    let result: DogInterpretResult;
    let resultSource: 'model' | 'fallback' = 'model';
    this.debugLog({
      msg: 'dog.interpret.model_request',
      traceId,
      model: this.audioModel,
      apiBase: this.apiBaseUrl,
      audioFormat: format,
      audioBytes: params.audio?.size,
      hasContext: Boolean(params.context),
    });
    try {
      result = await this.aiInterpret({
        locale: params.locale,
        petName: pet.name,
        breedId: pet.breedId,
        context: params.context,
        audioBase64: params.audio.buffer.toString('base64'),
        audioFormat: format,
      });
    } catch (e: any) {
      resultSource = 'fallback';
      this.errorLog(e, { msg: 'dog.interpret.model_failed', traceId, model: this.audioModel, apiBase: this.apiBaseUrl });
      const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
      result = {
        meaningText:
          lang === 'zh-CN'
            ? '我在叫，但我也不太确定我想表达什么。可能是想引起你的注意。'
            : "I'm making noise, but I'm not sure what I mean. Maybe I'm trying to get your attention.",
        dogEventType: 'OTHER',
        confidence: 0.2,
      };
    } finally {
      this.debugLog({ msg: 'dog.interpret.model_done', traceId, ms: Date.now() - t0, model: this.audioModel });
    }

    const eventType = this.normalizeDogEventType(result.dogEventType) ?? 'OTHER';
    const confidence = typeof result.confidence === 'number' ? result.confidence : undefined;
    const meaningTextPreview =
      typeof result.meaningText === 'string' ? result.meaningText.slice(0, 96) : '';
    this.debugLog({
      msg: 'dog.interpret.model_result',
      traceId,
      source: resultSource,
      model: this.audioModel,
      eventType,
      confidence: confidence ?? null,
      meaningTextLen: typeof result.meaningText === 'string' ? result.meaningText.length : 0,
      meaningTextPreview,
    });

    const ev = await this.prisma.dogEvent.create({
      data: {
        petId: params.petId,
        mode: 'DOG_TO_HUMAN',
        eventType,
        stateType: result.stateType ?? null,
        contextType: result.contextType ?? null,
        confidence,
        audioUrl: inputAudioUrl,
        meaningText: result.meaningText,
      },
    });
    this.debugLog({ msg: 'dog.interpret.persisted', traceId, eventId: ev.id, eventType, confidence });

    return {
      eventId: ev.id,
      inputAudioUrl,
      meaningText: result.meaningText,
      labels: {
        dogEventType: eventType,
        stateType: result.stateType ?? null,
        contextType: result.contextType ?? null,
      },
      confidence: confidence ?? null,
      modelVersion: this.audioModel,
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
    
    // 1. Save input audio
    const { format, ext: inputExt } = this.requireSupportedAudio(params.audio);
    const inputAudioUrl = this.saveUploadedFile('uploads/human-audio-input', params.audio, inputExt);
    this.debugLog({ msg: 'dog.synthesize.saved_input', traceId, inputAudioUrl });

    // 2. Use Multimodal AI to transcribe AND plan in one go (skips unreliable STT endpoint)
    const t1 = Date.now();
    let plan: DogSynthesizePlan;
    let planModelUsed = this.textModel;
    try {
      this.debugLog({
        msg: 'dog.synthesize.transcribe.request',
        traceId,
        model: this.transcribeModel,
        apiBase: this.apiBaseUrl,
        audioFormat: format,
        audioBytes: params.audio?.size,
      });
      const transcript = await this.aiTranscribeHumanAudio({
        locale: params.locale,
        file: params.audio,
      });
      this.debugLog({
        msg: 'dog.synthesize.transcribe.result',
        traceId,
        transcriptLen: transcript.length,
        transcriptPreview: transcript.slice(0, 96),
      });
      plan = await this.aiPlanBarkFromTranscript({
        locale: params.locale,
        style: params.style,
        transcript,
      });
      planModelUsed = this.textModel;
    } catch (e: any) {
      this.errorLog(e, { msg: 'dog.synthesize.plan_failed', traceId, apiBase: this.apiBaseUrl });
      this.debugLog({
        msg: 'dog.synthesize.multimodal_plan.request',
        traceId,
        model: this.audioModel,
        apiBase: this.apiBaseUrl,
        audioFormat: format,
        audioBytes: params.audio?.size,
      });
      plan = await this.aiPlanBarkMultimodal({
        locale: params.locale,
        style: params.style,
        audioBase64: params.audio.buffer.toString('base64'),
        audioFormat: format,
      });
      planModelUsed = this.audioModel;
    } finally {
      this.debugLog({
        msg: 'dog.synthesize.plan_done',
        traceId,
        ms: Date.now() - t1,
        planModel: planModelUsed,
      });
    }
    this.debugLog({
      msg: 'dog.synthesize.plan_result',
      traceId,
      planModel: planModelUsed,
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
        ttsModel: this.dogAudioOutputMode === 'synthetic' ? 'synthetic' : this.ttsModel,
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

    const outputAudioUrl = this.saveGeneratedFile('uploads/dog-audio-output', outputBytes, ext);
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
        plan: plan?.transcript ? this.textModel : this.audioModel,
        tts: this.dogAudioOutputMode === 'synthetic' ? 'synthetic' : this.ttsModel,
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
    
    // Save file immediately
    const { format, ext: inputExt } = this.requireSupportedAudio(params.audio);
    const inputAudioUrl = this.saveUploadedFile('uploads/human-audio-input', params.audio, inputExt);

    // Create Task
    const task = await this.prisma.dogTask.create({
      data: {
        userId: params.userId,
        petId: params.petId,
        type: 'SYNTHESIZE',
        status: 'PROCESSING',
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
      // 1. Plan
      const t1 = Date.now();
      let plan: DogSynthesizePlan;
      try {
        this.debugLog({
          msg: 'task.transcribe.request',
          traceId,
          model: this.transcribeModel,
          apiBase: this.apiBaseUrl,
        });
        const fileBytes = Buffer.from(params.audioBase64, 'base64');
        const ext = params.audioFormat === 'mp3' ? 'mp3' : 'wav';
        const transcript = await this.aiTranscribeHumanAudio({
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
          locale: params.locale,
          style: params.style,
          transcript,
        });
      } catch (e: any) {
        this.errorLog(e, { msg: 'task.plan.transcribe_failed_fallback_multimodal', taskId });
        this.debugLog({
          msg: 'task.multimodal_plan.request',
          traceId,
          model: this.audioModel,
          apiBase: this.apiBaseUrl,
          audioFormat: params.audioFormat,
        });
        plan = await this.aiPlanBarkMultimodal({
          locale: params.locale,
          style: params.style,
          audioBase64: params.audioBase64,
          audioFormat: params.audioFormat,
        });
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
        ttsModel: this.dogAudioOutputMode === 'synthetic' ? 'synthetic' : this.ttsModel,
        outputBytes: out.bytes?.length ?? 0,
        ext: out.ext,
      });

      // 3. Save
      const outputAudioUrl = this.saveGeneratedFile('uploads/dog-audio-output', out.bytes, out.ext);

      // 4. Create Event
      const task = await this.prisma.dogTask.findUnique({ where: { id: taskId } });
      if (!task) return; // Should not happen

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
          plan: plan?.transcript ? this.textModel : this.audioModel,
          tts: this.dogAudioOutputMode === 'synthetic' ? 'synthetic' : this.ttsModel,
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

  // ... (assertPetOwnership, saveUploadedFile, saveGeneratedFile, safeExt, requireSupportedAudio unchanged)
  private async assertPetOwnership(userId: number, petId: number) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      select: { id: true, ownerId: true, name: true, breedId: true },
    });
    if (!pet) throw new NotFoundException('Pet not found');
    if (pet.ownerId !== userId) throw new ForbiddenException('Forbidden');
    return pet;
  }

  private saveUploadedFile(dirRelative: string, file: Express.Multer.File, ext: string) {
    const dir = join(process.cwd(), dirRelative);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}-${Date.now()}.${ext}`;
    const uploadPath = join(dir, filename);
    const writeStream = createWriteStream(uploadPath);
    writeStream.write(file.buffer);
    writeStream.end();
    return `/${dirRelative.replace(/^\//, '')}/${filename}`;
  }

  private saveGeneratedFile(dirRelative: string, bytes: Uint8Array, ext: string) {
    const dir = join(process.cwd(), dirRelative);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}-${Date.now()}.${ext}`;
    const uploadPath = join(dir, filename);
    const writeStream = createWriteStream(uploadPath);
    writeStream.write(Buffer.from(bytes));
    writeStream.end();
    return `/${dirRelative.replace(/^\//, '')}/${filename}`;
  }

  private safeExt(file: Express.Multer.File) {
    const name = (file.originalname ?? '').toLowerCase();
    if (name.endsWith('.wav')) return 'wav';
    if (name.endsWith('.mp3')) return 'mp3';
    if (name.endsWith('.m4a')) return 'm4a';
    if (name.endsWith('.aac')) return 'aac';
    return 'bin';
  }

  private requireSupportedAudio(file: Express.Multer.File): { format: 'wav' | 'mp3'; ext: string } {
    const mime = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();
    if (mime.includes('wav') || name.endsWith('.wav')) return { format: 'wav', ext: 'wav' };
    if (mime.includes('mpeg') || name.endsWith('.mp3')) return { format: 'mp3', ext: 'mp3' };
    throw new BadRequestException('Unsupported audio format. Please upload wav or mp3.');
  }

  private async aiInterpret(params: {
    locale?: string;
    petName?: string;
    breedId?: string;
    context?: string;
    audioBase64: string;
    audioFormat: 'wav' | 'mp3';
  }): Promise<DogInterpretResult> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');

    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    const prompt =
      lang === 'zh-CN'
        ? [
            '你是一位专业的犬类行为专家和“狗语翻译官”。',
            '任务：仔细分析这段狗叫录音的情绪、语调、频率和持续时间，推测这只狗想要表达的具体含义。',
            '输出：必须是纯 JSON，不能包含 markdown 或多余解释。',
            'JSON 字段说明：',
            '- meaningText: (字符串) 用第一人称（如“我好开心”、“别过来”）翻译出的狗的心声，要生动、符合场景。',
            '- dogEventType: (枚举) 吠叫类型，选其一：BARK(普通叫), HOWL(嚎叫), WHINE(呜咽), GROWL(低吼), OTHER(其他)。',
            '- confidence: (数字) 0到1之间的置信度。',
            params.petName || params.breedId
              ? `宠物信息：name=${params.petName ?? ''}, breedId=${params.breedId ?? ''}`
              : '',
            params.context ? `用户场景补充：${params.context}` : '',
          ]
            .filter((x) => x.length > 0)
            .join('\n')
        : [
            'You are a professional canine behaviorist and "Dog Translator".',
            'Task: Analyze the emotion, tone, frequency, and duration of this dog vocalization to deduce the dog\'s specific intent.',
            'Output: MUST be pure JSON with no markdown or extra explanation.',
            'JSON Fields:',
            '- meaningText: (string) The translation of the dog\'s inner thoughts in first person (e.g., "I\'m so happy", "Stay away"), lively and context-aware.',
            '- dogEventType: (enum) One of: BARK, HOWL, WHINE, GROWL, OTHER.',
            '- confidence: (number) 0 to 1.',
            params.petName || params.breedId ? `Pet context: name=${params.petName ?? ''}, breedId=${params.breedId ?? ''}` : '',
            params.context ? `User context: ${params.context}` : '',
          ]
            .filter((x) => x.length > 0)
            .join('\n');

    let content: string | undefined;
    try {
      const body = {
        model: this.audioModel,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'input_audio',
                input_audio: {
                  data: params.audioBase64,
                  format: params.audioFormat,
                },
              },
            ],
          },
        ],
      };
      const res = await this.aiFetchJson(`${this.apiBaseUrl}/chat/completions`, body);
      content = res?.choices?.[0]?.message?.content;
    } catch (e: any) {
      this.errorLog(e, { msg: 'ai.interpret.chat_failed_try_responses' });
      const body = {
        model: this.audioModel,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_audio',
                input_audio: {
                  data: params.audioBase64,
                  format: params.audioFormat,
                },
              },
            ],
          },
        ],
      };
      const res = await this.aiFetchJson(`${this.apiBaseUrl}/responses`, body);
      content = this.extractTextFromResponses(res);
    }
    if (!content) throw new BadGatewayException('AI response is empty');
    const parsed = this.tryParseJson(content);
    if (!parsed) throw new BadGatewayException('AI response is not JSON');

    const meaningText = typeof parsed.meaningText === 'string' ? parsed.meaningText : '';
    if (!meaningText.trim()) throw new BadGatewayException('AI meaningText is empty');
    return {
      meaningText: meaningText.trim(),
      dogEventType: this.normalizeDogEventType(parsed.dogEventType) ?? 'OTHER',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
    };
  }

  // aiTranscribe skipped (not used in main flow)

  private async aiPlanBarkMultimodal(params: {
    locale?: string;
    style?: string;
    audioBase64: string;
    audioFormat: 'wav' | 'mp3';
  }): Promise<DogSynthesizePlan> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');

    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    const system =
      lang === 'zh-CN'
        ? [
            '你是 RealDog 的“人话→狗叫规划器”。',
            '你需要完成两步：',
            '1. 识别用户音频内容（Transcript）。',
            '2. 根据内容和风格，转换成狗能理解的“发声计划”。',
            '只输出 JSON，不要 markdown。',
            'JSON schema: {"transcript": string, "barkType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","intensity":number,"dogText":string}',
            'intensity 取 0~1，小数。',
            'dogText 用于生成“狗叫音频”的提示词，应该像狗叫（短、拟声、带情绪）。',
          ].join('\n')
        : [
            'You are RealDog human-to-dog vocalization planner.',
            'Two steps:',
            '1. Transcribe user audio.',
            '2. Convert intent to dog vocalization plan.',
            'Output JSON only.',
            'JSON schema: {"transcript": string, "barkType":"BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER","intensity":number,"dogText":string}',
            'intensity is 0~1 float. dogText should be short onomatopoeia with emotion.',
          ].join('\n');

    const userText =
      lang === 'zh-CN'
        ? `风格：${params.style ?? 'default'}`
        : `Style: ${params.style ?? 'default'}`;

    let content: string | undefined;
    try {
      const body = {
        model: this.audioModel,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              {
                type: 'input_audio',
                input_audio: {
                  data: params.audioBase64,
                  format: params.audioFormat,
                },
              },
            ],
          },
        ],
      };
      const res = await this.aiFetchJson(`${this.apiBaseUrl}/chat/completions`, body);
      content = res?.choices?.[0]?.message?.content;
    } catch (e: any) {
      this.errorLog(e, { msg: 'ai.plan.chat_failed_try_responses' });
      const body = {
        model: this.audioModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: userText },
              {
                type: 'input_audio',
                input_audio: {
                  data: params.audioBase64,
                  format: params.audioFormat,
                },
              },
            ],
          },
        ],
      };
      const res = await this.aiFetchJson(`${this.apiBaseUrl}/responses`, body);
      content = this.extractTextFromResponses(res);
    }
    if (!content) throw new BadGatewayException('AI response is empty');
    const parsed = this.tryParseJson(content);
    if (!parsed) throw new BadGatewayException('AI response is not JSON');

    const barkType = this.normalizeDogEventType(parsed.barkType) ?? 'OTHER';
    const intensity = typeof parsed.intensity === 'number' ? parsed.intensity : 0.6;
    const dogText = typeof parsed.dogText === 'string' ? parsed.dogText : 'Woof!';
    const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : '';

    return {
      barkType,
      intensity: Math.max(0, Math.min(1, intensity)),
      dogText: dogText.trim() || 'Woof!',
      transcript,
    };
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
    if (!this.apiKey) {
      return { bytes: this.synthDogWav(params.barkType, params.intensity), ext: 'wav' };
    }
    const lang = params.locale?.startsWith('zh') ? 'zh-CN' : 'en';
    const input =
      lang === 'zh-CN'
        ? `用“狗叫/拟声”的方式表达：${params.dogText}\n强度：${params.intensity}\n类型：${params.barkType}`
        : `Express as dog-like barking/onomatopoeia: ${params.dogText}\nIntensity: ${params.intensity}\nType: ${params.barkType}`;

    const timeoutMs = 15000;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(`${this.apiBaseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.ttsModel,
          voice: 'alloy',
          input,
          response_format: 'mp3',
        }),
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException('AI request timeout');
      throw new BadGatewayException('AI request failed');
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      // Fallback to synthetic if API fails
      this.errorLog(null, { msg: 'ai.tts_api_failed_fallback_synthetic', status: res.status });
      return { bytes: this.synthDogWav(params.barkType, params.intensity), ext: 'wav' };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, ext: 'mp3' };
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

  private async aiFetchJson(url: string, body: any): Promise<any> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');

    const timeoutMs = 25000; // Increased timeout
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException('AI request timeout');
      throw new BadGatewayException('AI request failed: ' + e.message);
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const snippet = await this.tryReadBodySnippet(res);
      this.debugLog({ msg: 'ai.http_error', url, status: res.status, body: snippet });
      // CRITICAL CHANGE: Throw specific HttpException so we see the real upstream error
      throw new HttpException(
        `AI Gateway Error ${res.status}: ${snippet || 'Unknown'}`, 
        res.status >= 500
          ? 502
          : res.status === 401 || res.status === 403 || res.status === 404
            ? 502
            : res.status === 429
              ? 503
              : 400
      );
    }
    return res.json();
  }

  private extractTextFromResponses(res: any): string | undefined {
    if (!res) return undefined;
    if (typeof res.output_text === 'string' && res.output_text.trim()) return res.output_text.trim();
    const output = Array.isArray(res.output) ? res.output : [];
    for (const item of output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c?.text === 'string' && c.text.trim()) return c.text.trim();
      }
    }
    return undefined;
  }

  private async aiTranscribeHumanAudio(params: {
    locale?: string;
    file: Express.Multer.File;
  }): Promise<string> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');
    const ext = this.safeExt(params.file);
    const blob = new Blob([Uint8Array.from(params.file.buffer)], {
      type: params.file.mimetype && params.file.mimetype.trim() ? params.file.mimetype : 'application/octet-stream',
    });
    const form = new FormData();
    form.append('model', this.transcribeModel);
    form.append('file', blob, `input.${ext}`);
    const lang = params.locale?.startsWith('zh') ? 'zh' : 'en';
    form.append('language', lang);

    const timeoutMs = 25000;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(`${this.apiBaseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: form as any,
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException('AI request timeout');
      throw new BadGatewayException('AI request failed');
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const snippet = await this.tryReadBodySnippet(res);
      throw new HttpException(`AI Gateway Error ${res.status}: ${snippet || 'Unknown'}`, res.status >= 500 ? 502 : 400);
    }
    const data = (await res.json()) as any;
    const text = typeof data?.text === 'string' ? data.text : '';
    if (!text.trim()) throw new BadGatewayException('AI transcription is empty');
    return text.trim();
  }

  private async aiPlanBarkFromTranscript(params: {
    locale?: string;
    style?: string;
    transcript: string;
  }): Promise<DogSynthesizePlan> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured');
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

    const body = {
      model: this.textModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    const res = await this.aiFetchJson(`${this.apiBaseUrl}/chat/completions`, body);
    const content: string | undefined = res?.choices?.[0]?.message?.content;
    if (!content) throw new BadGatewayException('AI response is empty');
    const parsed = this.tryParseJson(content);
    if (!parsed) throw new BadGatewayException('AI response is not JSON');

    const barkType = this.normalizeDogEventType(parsed.barkType) ?? 'OTHER';
    const intensity = typeof parsed.intensity === 'number' ? parsed.intensity : 0.6;
    const dogText = typeof parsed.dogText === 'string' ? parsed.dogText : 'Woof!';
    const transcript = typeof parsed.transcript === 'string' ? parsed.transcript : params.transcript;

    return {
      barkType,
      intensity: Math.max(0, Math.min(1, intensity)),
      dogText: dogText.trim() || 'Woof!',
      transcript,
    };
  }

  private async tryReadBodySnippet(res: any): Promise<string | null> {
    try {
      const text = await res.text();
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) return null;
      return trimmed.length > 800 ? `${trimmed.slice(0, 800)}...` : trimmed;
    } catch {
      return null;
    }
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
