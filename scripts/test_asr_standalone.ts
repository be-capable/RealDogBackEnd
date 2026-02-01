
import { VolcengineAsrProvider } from '../src/ai/providers/volcengine-asr.provider';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('--- Starting ASR Test ---');
  console.log('AI_STUB_MODE:', process.env.AI_STUB_MODE);
  console.log('VOLC_ASR_APP_ID:', process.env.VOLC_ASR_APP_ID);
  console.log('VOLC_ASR_ACCESS_TOKEN:', process.env.VOLC_ASR_ACCESS_TOKEN ? '***' : 'missing');

  const provider = new VolcengineAsrProvider();
  
  // Pick the most recent file found in the previous step
  const audioFile = '2169710f-840e-4bdd-aa49-56e290796008-1769918612010.wav';
  const audioPath = path.join(__dirname, '../uploads/dog-audio-input', audioFile);

  if (!fs.existsSync(audioPath)) {
    console.error(`Audio file not found at: ${audioPath}`);
    return;
  }

  const audioBuffer = fs.readFileSync(audioPath);
  console.log(`Read audio file: ${audioFile}, size: ${audioBuffer.length} bytes`);

  try {
    console.log('Calling transcribe...');
    const result = await provider.transcribe({
      audioBytes: audioBuffer,
      format: 'wav',
      locale: 'en-US',
      uid: 'test-user-script'
    });

    console.log('--- ASR Result ---');
    console.log('Text:', result.text);
    console.log('Vendor:', result.vendor);
    console.log('Model:', result.model);
    console.log('Raw:', JSON.stringify(result.raw, null, 2));

  } catch (error: any) {
    console.error('--- ASR Error ---');
    console.error(error.message);
    if (error.response) {
       console.error('Response data:', error.response.data);
    }
  }
}

run();
