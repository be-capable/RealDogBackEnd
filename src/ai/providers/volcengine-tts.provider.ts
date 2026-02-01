import { BadGatewayException, GatewayTimeoutException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TtsProvider, TtsSynthesizeParams, TtsSynthesizeResult } from './provider.types';

@Injectable()
export class VolcengineTtsProvider implements TtsProvider {
  private readonly apiUrl: string;
  private readonly appId: string | undefined;
  private readonly token: string | undefined;
  private readonly cluster: string | undefined;
  private readonly voiceTypeZh: string | undefined;
  private readonly voiceTypeEn: string | undefined;
  private readonly encoding: 'mp3' | 'wav';

  constructor() {
    this.apiUrl = (process.env.VOLC_TTS_HTTP_URL ?? 'https://openspeech.bytedance.com/api/v1/tts').trim();
    this.appId = process.env.VOLC_TTS_APP_ID;
    this.token = process.env.VOLC_TTS_ACCESS_TOKEN ?? process.env.VOLC_TTS_TOKEN;
    this.cluster = process.env.VOLC_TTS_CLUSTER;
    this.voiceTypeZh = process.env.VOLC_TTS_VOICE_TYPE_ZH ?? process.env.VOLC_TTS_VOICE_TYPE;
    this.voiceTypeEn = process.env.VOLC_TTS_VOICE_TYPE_EN ?? process.env.VOLC_TTS_VOICE_TYPE;
    this.encoding = (process.env.VOLC_TTS_ENCODING ?? 'mp3') === 'wav' ? 'wav' : 'mp3';
  }

  async synthesize(params: TtsSynthesizeParams): Promise<TtsSynthesizeResult> {
    const stubMode =
      (process.env.AI_STUB_MODE ?? '').trim() === 'true' && (process.env.NODE_ENV ?? '').trim() !== 'production';
    if (!this.appId || !this.token || !this.cluster) {
      if (stubMode) {
        return { bytes: new Uint8Array([1, 2, 3, 4]), ext: this.encoding, raw: { stub: true }, vendor: 'stub', model: 'stub' };
      }
      if (!this.appId) throw new ServiceUnavailableException('VOLC_TTS_APP_ID is not configured');
      if (!this.token) throw new ServiceUnavailableException('VOLC_TTS_ACCESS_TOKEN is not configured');
      if (!this.cluster) throw new ServiceUnavailableException('VOLC_TTS_CLUSTER is not configured');
    }

    const voiceType = this.pickVoiceType(params.locale);
    if (!voiceType) throw new ServiceUnavailableException('VOLC_TTS_VOICE_TYPE is not configured');

    const reqid = randomUUID();
    const uid = (params.uid ?? 'real-dog').slice(0, 64);
    const body = {
      app: { appid: this.appId, token: this.token, cluster: this.cluster },
      user: { uid },
      audio: { voice_type: voiceType, encoding: this.encoding, speed_ratio: 1.0, volume_ratio: 1.0, pitch_ratio: 1.0 },
      request: { reqid, text: params.text, operation: 'query' },
    };

    const timeoutMs = 30000;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);

    let res: any;
    try {
      res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer; ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException('TTS request timeout');
      throw new BadGatewayException('TTS request failed');
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`TTS error ${res.status}: ${text || 'Unknown'}`);
    }

    const data = (await res.json()) as any;
    if (typeof data?.code === 'number' && data.code !== 3000 && data.code !== 0 && data.code !== 1000) {
      throw new BadGatewayException(`TTS vendor error ${data.code}: ${data?.message ?? 'Unknown'}`);
    }

    const b64 = typeof data?.data === 'string' ? data.data : '';
    if (!b64.trim()) throw new BadGatewayException('TTS audio is empty');

    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
    } catch {
      throw new BadGatewayException('TTS audio decode failed');
    }

    return { bytes, ext: this.encoding, raw: data, vendor: 'volcengine', model: voiceType };
  }

  private pickVoiceType(locale?: string) {
    const isZh = locale?.startsWith('zh') ?? true;
    return isZh ? this.voiceTypeZh : this.voiceTypeEn;
  }
}
