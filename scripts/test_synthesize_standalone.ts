
import { DogAiService } from '../src/ai/dog-ai.service';
import { VolcengineAsrProvider } from '../src/ai/providers/volcengine-asr.provider';
import { ArkLlmProvider } from '../src/ai/providers/ark-llm.provider';
import { VolcengineTtsProvider } from '../src/ai/providers/volcengine-tts.provider';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const mockPrisma = {
  pet: {
    findUnique: async () => ({ id: 3, ownerId: 3, name: 'Buddy', breedId: 1 }),
  },
  dogEvent: {
    create: async (args: any) => ({ id: 999, ...args.data }),
  },
  dogTask: {
    create: async (args: any) => ({ id: 'task-123', ...args.data }),
    update: async () => {},
    findUnique: async () => ({ id: 'task-123', userId: 3, petId: 3, status: 'PENDING' }),
  },
};

const mockS3Service = {
  isConfigured: () => true,
  upload: async (buffer: Buffer, key: string, contentType: string) => ({
    key,
    url: `https://test-bucket.r2.cloudflarestorage.com/${key}`,
  }),
  generateAudioKey: (petId: number, ext: string, scene: string) =>
    `pets/${petId}/audio/${scene}/test.${ext}`,
  getPublicUrl: (key: string) => `https://test-bucket.r2.cloudflarestorage.com/${key}`,
  delete: async () => {},
};

const mockI18nService = {
  t: (key: string, lang: string = 'en') => key,
};

async function run() {
  console.log('--- Starting Human-to-Dog Synthesis Test ---');
  console.log('AI_STUB_MODE:', process.env.AI_STUB_MODE);

  const asr = new VolcengineAsrProvider();
  const llm = new ArkLlmProvider();
  const tts = new VolcengineTtsProvider();

  const service = new DogAiService(mockPrisma as any, mockS3Service as any, asr, llm, tts, mockI18nService as any);

  // Find a test file
  const audioDir = path.join(__dirname, '../uploads/dog-audio-input');
  if (!fs.existsSync(audioDir)) {
      console.log('Audio dir not found, creating dummy buffer');
      fs.mkdirSync(audioDir, { recursive: true });
  }
  
  let audioBuffer: Buffer;
  let filename = 'test_input.wav';

  const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav'));
  if (files.length > 0) {
      filename = files[files.length - 1];
      audioBuffer = fs.readFileSync(path.join(audioDir, filename));
      console.log(`Using existing file: ${filename}`);
  } else {
      console.log('No files found, using empty buffer (might fail ASR check if not stubbed)');
      audioBuffer = Buffer.alloc(1024); // Dummy
  }
  
  const mockFile = {
      buffer: audioBuffer,
      mimetype: 'audio/x-wav',
      originalname: filename,
      size: audioBuffer.length
  };

  try {
    console.log('Calling synthesizeDogAudio...');
    const result = await service.synthesizeDogAudio({
        userId: 3,
        petId: 3,
        locale: 'en-US',
        style: 'happy',
        audio: mockFile as any
    });

    console.log('--- Synthesis Result ---');
    console.log('Event ID:', result.eventId);
    console.log('Output URL:', result.outputAudioUrl);
    console.log('Bark Type:', result.labels.dogEventType);
    console.log('Model Version:', JSON.stringify(result.modelVersion));

  } catch (error: any) {
    console.error('--- Synthesis Error ---');
    console.error(error.message);
    console.error(error.stack);
  }
}

run();
