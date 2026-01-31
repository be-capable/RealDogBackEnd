import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DogAiService } from './dog-ai.service';

describe('DogAiService', () => {
  let prisma: PrismaService;
  let service: DogAiService;

  beforeAll(async () => {
    process.env.GEMINI3_API_KEY = 'test';
    process.env.DOG_AUDIO_OUTPUT_MODE = 'synthetic';

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, DogAiService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service = module.get<DogAiService>(DogAiService);

    await prisma.dogEvent.deleteMany();
    await prisma.petMedia.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.dogEvent.deleteMany();
    await prisma.petMedia.deleteMany();
    await prisma.pet.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('interpretDogAudio creates event with meaningText', async () => {
    const user = await prisma.user.create({
      data: { email: 'dogai1@example.com', password: 'x' },
    });
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
        name: '豆豆',
        sex: 'MALE',
        birthDate: new Date('2020-01-01'),
        breedId: 'golden_retriever',
      },
    });

    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ meaningText: '它很兴奋，想出去玩。', dogEventType: 'BARK', confidence: 0.8 }),
            },
          },
        ],
      }),
    });

    const audio: any = {
      buffer: Buffer.from([0, 1, 2, 3]),
      mimetype: 'audio/wav',
      originalname: 'dog.wav',
    };

    const out = await service.interpretDogAudio({
      userId: user.id,
      petId: pet.id,
      locale: 'zh-CN',
      context: '刚回家',
      audio,
    });

    expect(out.eventId).toBeGreaterThan(0);
    expect(out.meaningText).toContain('兴奋');
    expect(out.inputAudioUrl).toContain('/uploads/dog-audio-input/');

    const ev = await prisma.dogEvent.findUnique({ where: { id: out.eventId } });
    expect(ev?.mode).toBe('DOG_TO_HUMAN');
    expect(ev?.meaningText).toBeTruthy();
    expect(ev?.audioUrl).toBeTruthy();
  });

  it('synthesizeDogAudio creates event with outputAudioUrl', async () => {
    const user = await prisma.user.create({
      data: { email: 'dogai2@example.com', password: 'x' },
    });
    const pet = await prisma.pet.create({
      data: {
        ownerId: user.id,
        name: '小黑',
        sex: 'FEMALE',
        birthDate: new Date('2021-01-01'),
        breedId: 'shiba',
      },
    });

    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: '我想出去玩' }),
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ barkType: 'BARK', intensity: 0.7, dogText: 'Wuff! Wuff!' }),
            },
          },
        ],
      }),
    });

    const audio: any = {
      buffer: Buffer.from([0, 1, 2, 3]),
      mimetype: 'audio/wav',
      originalname: 'human.wav',
    };

    const out = await service.synthesizeDogAudio({
      userId: user.id,
      petId: pet.id,
      locale: 'zh-CN',
      style: 'playful',
      audio,
    });

    expect(out.eventId).toBeGreaterThan(0);
    expect(out.inputAudioUrl).toContain('/uploads/human-audio-input/');
    expect(out.outputAudioUrl).toContain('/uploads/dog-audio-output/');

    const ev = await prisma.dogEvent.findUnique({ where: { id: out.eventId } });
    expect(ev?.mode).toBe('HUMAN_TO_DOG');
    expect(ev?.outputAudioUrl).toBeTruthy();
    expect(ev?.inputTranscript).toContain('出去玩');
  });
});
