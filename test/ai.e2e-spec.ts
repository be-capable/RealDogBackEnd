import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'child_process';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ASR_PROVIDER, LLM_PROVIDER, TTS_PROVIDER } from '../src/ai/providers/provider.tokens';

function makeSilentWav(params: { durationMs: number; sampleRate?: number }) {
  const sampleRate = params.sampleRate ?? 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.max(1, Math.floor((sampleRate * params.durationMs) / 1000));
  const dataSize = numSamples * numChannels * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe('AI endpoints (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let petId = 0;

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { stdio: 'pipe' });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ASR_PROVIDER)
      .useValue({
        transcribe: async () => ({ text: 'woof woof', vendor: 'stub', model: 'stub' }),
      })
      .overrideProvider(LLM_PROVIDER)
      .useValue({
        chat: async ({ messages }: any) => ({
          content: JSON.stringify({
            meaningText: messages?.some((m: any) => String(m?.content ?? '').includes('ASR'))
              ? '我只是想引起你的注意'
              : 'Woof!',
            dogEventType: 'BARK',
            confidence: 0.88,
            stateType: 'HAPPY',
            contextType: 'PLAYING',
          }),
          vendor: 'stub',
          model: 'stub',
        }),
      })
      .overrideProvider(TTS_PROVIDER)
      .useValue({
        synthesize: async () => ({ bytes: new Uint8Array([1, 2, 3]), ext: 'mp3', vendor: 'stub', model: 'stub' }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    const email = `e2e_${Date.now()}@example.com`;
    const password = 'Secret123!';
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password, name: 'e2e' })
      .expect(201);
    accessToken = reg.body.accessToken;

    const pet = await request(app.getHttpServer())
      .post('/api/pets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Buddy',
        sex: 'MALE',
        birthDate: '2020-01-01',
        breedId: 'golden_retriever',
      })
      .expect(201);
    petId = pet.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/ai/dog/interpret returns meaningText and outputAudioUrl', async () => {
    const wav = makeSilentWav({ durationMs: 400 });
    const res = await request(app.getHttpServer())
      .post('/api/ai/dog/interpret')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('petId', String(petId))
      .field('locale', 'zh-CN')
      .attach('audio', wav, { filename: 'dog.wav', contentType: 'audio/wav' })
      .expect(201);

    expect(typeof res.body.eventId).toBe('number');
    expect(typeof res.body.inputAudioUrl).toBe('string');
    expect(typeof res.body.outputAudioUrl).toBe('string');
    expect(typeof res.body.meaningText).toBe('string');
  });

  it('POST /api/ai/dog/synthesize returns outputAudioUrl', async () => {
    const wav = makeSilentWav({ durationMs: 400 });
    const res = await request(app.getHttpServer())
      .post('/api/ai/dog/synthesize')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('petId', String(petId))
      .field('locale', 'en-US')
      .attach('audio', wav, { filename: 'human.wav', contentType: 'audio/wav' })
      .expect(201);

    expect(typeof res.body.eventId).toBe('number');
    expect(typeof res.body.inputAudioUrl).toBe('string');
    expect(typeof res.body.outputAudioUrl).toBe('string');
  });

  it('POST /api/ai/dog/synthesize-task can be polled via GET /api/ai/dog/task/:id', async () => {
    const wav = makeSilentWav({ durationMs: 400 });
    const created = await request(app.getHttpServer())
      .post('/api/ai/dog/synthesize-task')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('petId', String(petId))
      .field('locale', 'en-US')
      .attach('audio', wav, { filename: 'human.wav', contentType: 'audio/wav' })
      .expect(201);

    expect(typeof created.body.taskId).toBe('string');
    const taskId = created.body.taskId as string;

    let last: any = null;
    for (let i = 0; i < 10; i++) {
      last = await request(app.getHttpServer())
        .get(`/api/ai/dog/task/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).toContain(last.body.status);
      expect(last.body.createdAt).toBeTruthy();
      expect(last.body.updatedAt).toBeTruthy();

      if (last.body.status === 'COMPLETED') break;
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(last.body.status).toBe('COMPLETED');
    expect(last.body.result).toBeTruthy();
    expect(typeof last.body.result.eventId).toBe('number');
    expect(typeof last.body.result.inputAudioUrl).toBe('string');
    expect(typeof last.body.result.outputAudioUrl).toBe('string');
  });
});
