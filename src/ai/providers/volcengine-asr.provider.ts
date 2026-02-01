import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { gunzipSync, gzipSync } from 'zlib';
import { randomUUID } from 'crypto';
import { WebSocket } from 'undici';
import { AsrProvider, AsrTranscribeParams, AsrTranscribeResult } from './provider.types';

type WsMessage = Buffer;

@Injectable()
export class VolcengineAsrProvider implements AsrProvider {
  private readonly logger = new Logger(VolcengineAsrProvider.name);
  private readonly wsUrl: string;
  private readonly appId: string | undefined;
  private readonly token: string | undefined;
  private readonly cluster: string | undefined;
  private readonly uid: string;
  private readonly workflow: string;

  constructor() {
    this.wsUrl = (process.env.VOLC_ASR_WS_URL ?? 'wss://openspeech.bytedance.com/api/v2/asr').trim();
    this.appId = process.env.VOLC_ASR_APP_ID;
    this.token = process.env.VOLC_ASR_ACCESS_TOKEN ?? process.env.VOLC_ASR_TOKEN;
    this.cluster = process.env.VOLC_ASR_CLUSTER;
    this.uid = (process.env.VOLC_ASR_UID ?? 'real-dog').trim();
    this.workflow = (process.env.VOLC_ASR_WORKFLOW ?? 'audio_in,resample,partition,vad,fe,decode,itn,nlu_punctuate').trim();
  }

  async transcribe(params: AsrTranscribeParams): Promise<AsrTranscribeResult> {
    const stubMode =
      (process.env.AI_STUB_MODE ?? '').trim() === 'true' && (process.env.NODE_ENV ?? '').trim() !== 'production';
    if (!this.appId || !this.token || !this.cluster) {
      if (stubMode) {
        const lang = this.toAsrLanguage(params.locale);
        const text = lang.startsWith('zh') ? '汪汪' : 'woof';
        return { text, raw: { stub: true }, vendor: 'stub', model: 'stub' };
      }
      if (!this.appId) throw new ServiceUnavailableException('VOLC_ASR_APP_ID is not configured');
      if (!this.token) throw new ServiceUnavailableException('VOLC_ASR_ACCESS_TOKEN is not configured');
      if (!this.cluster) throw new ServiceUnavailableException('VOLC_ASR_CLUSTER is not configured');
    }

    const language = this.toAsrLanguage(params.locale);
    const reqid = randomUUID();
    
    this.logger.debug({
      msg: 'asr.volc.start',
      reqid,
      audioBytes: params.audioBytes.byteLength,
      format: params.format,
      language,
    });

    const requestBody = {
      app: { appid: this.appId, token: this.token, cluster: this.cluster },
      user: { uid: params.uid ?? this.uid },
      request: {
        reqid,
        nbest: 1,
        workflow: this.workflow,
        show_language: false,
        show_utterances: false,
        result_type: 'full',
        sequence: 1,
      },
      audio: {
        format: params.format,
        rate: 16000,
        bits: 16,
        channel: 1,
        codec: 'raw',
        language,
      },
    };

    const fullClientRequest = this.buildFullClientRequest(requestBody);

    const ws = new WebSocket(this.wsUrl, {
      headers: {
        Authorization: `Bearer; ${this.token}`,
      },
    });

    const result = await new Promise<any>((resolve, reject) => {
      const timeoutMs = 30000;
      const t = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new BadGatewayException('ASR request timeout'));
      }, timeoutMs);

      let lastPayload: any;

      ws.addEventListener('error', (err) => {
        clearTimeout(t);
        this.logger.error({ msg: 'asr.volc.ws_error', reqid, err });
        reject(new BadGatewayException('ASR websocket error'));
      });

      ws.addEventListener('open', async () => {
        try {
          this.logger.debug({ msg: 'asr.volc.ws_open', reqid });
          ws.send(fullClientRequest);
          await this.waitOneMessage(ws);

          let chunkCount = 0;
          for (const frame of this.buildAudioFrames(params.audioBytes, params.format)) {
            ws.send(frame);
            chunkCount++;
            const msg = await this.waitOneMessage(ws);
            lastPayload = msg;
          }
          this.logger.debug({ msg: 'asr.volc.sent_all', reqid, chunkCount });
          clearTimeout(t);
          resolve(lastPayload);
        } catch (e: any) {
          clearTimeout(t);
          reject(e);
        } finally {
          try {
            ws.close();
          } catch {}
        }
      });
    });

    const parsed = this.parseResponse(result);
    this.logger.debug({ msg: 'asr.volc.response', reqid, raw: parsed });

    const text = this.extractTranscript(parsed);
    if (!text) {
        this.logger.warn({ msg: 'asr.volc.empty_transcript', reqid });
        return { text: '', raw: parsed, vendor: 'volcengine', model: 'asr/v2' };
        // throw new BadGatewayException('ASR transcript is empty');
    }

    // if (!text) throw new BadGatewayException('ASR transcript is empty');

    return { text, raw: parsed, vendor: 'volcengine', model: 'asr/v2' };
  }

  private toAsrLanguage(locale?: string) {
    if (!locale) return 'zh-CN';
    if (locale.startsWith('zh')) return 'zh-CN';
    if (locale.startsWith('en')) return 'en-US';
    return locale;
  }

  private buildFullClientRequest(payload: any) {
    const payloadBytes = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));
    const header = this.generateHeader({
      messageType: 0b0001,
      messageTypeSpecificFlags: 0b0000,
      serializationMethod: 0b0001,
      compression: 0b0001,
    });
    const size = Buffer.alloc(4);
    size.writeUInt32BE(payloadBytes.length, 0);
    return Buffer.concat([header, size, payloadBytes]);
  }

  private *buildAudioFrames(audioBytes: Uint8Array, format: 'wav' | 'mp3') {
    const chunkSize = format === 'mp3' ? 10000 : 6400;
    let offset = 0;
    while (offset < audioBytes.length) {
      const end = Math.min(audioBytes.length, offset + chunkSize);
      const chunk = audioBytes.slice(offset, end);
      offset = end;
      const last = offset >= audioBytes.length;
      const payloadBytes = gzipSync(Buffer.from(chunk));
      const header = this.generateHeader({
        messageType: 0b0010,
        messageTypeSpecificFlags: last ? 0b0010 : 0b0000,
        serializationMethod: 0b0001,
        compression: 0b0001,
      });
      const size = Buffer.alloc(4);
      size.writeUInt32BE(payloadBytes.length, 0);
      yield Buffer.concat([header, size, payloadBytes]);
    }
  }

  private async waitOneMessage(ws: WebSocket): Promise<WsMessage> {
    return new Promise((resolve, reject) => {
      const onMessage = (event: any) => {
        cleanup();
        this.toBuffer(event.data).then(resolve, reject);
      };
      const onClose = () => {
        cleanup();
        reject(new BadGatewayException('ASR websocket closed'));
      };
      const onError = () => {
        cleanup();
        reject(new BadGatewayException('ASR websocket error'));
      };
      const cleanup = () => {
        ws.removeEventListener('message', onMessage as any);
        ws.removeEventListener('close', onClose as any);
        ws.removeEventListener('error', onError as any);
      };
      ws.addEventListener('message', onMessage as any);
      ws.addEventListener('close', onClose as any);
      ws.addEventListener('error', onError as any);
    });
  }

  private async toBuffer(data: any): Promise<Buffer> {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    if (typeof data === 'string') return Buffer.from(data);
    if (data && typeof data.arrayBuffer === 'function') {
      const ab = await data.arrayBuffer();
      return Buffer.from(ab);
    }
    throw new BadGatewayException('ASR websocket message type unsupported');
  }

  private parseResponse(buf: WsMessage) {
    if (buf.length < 8) return null;
    const headerSize = buf[0] & 0x0f;
    const messageType = buf[1] >> 4;
    const serializationMethod = buf[2] >> 4;
    const compression = buf[2] & 0x0f;
    const headerBytes = headerSize * 4;
    const payload = buf.slice(headerBytes);
    let payloadMsg: Buffer | null = null;

    if (messageType === 0b1001) {
      payloadMsg = payload.slice(4);
    } else if (messageType === 0b1011) {
      payloadMsg = payload.length >= 8 ? payload.slice(8) : null;
    } else if (messageType === 0b1111) {
      payloadMsg = payload.length >= 8 ? payload.slice(8) : null;
    }

    if (!payloadMsg) return null;
    let out = payloadMsg;
    if (compression === 0b0001) {
      try {
        out = gunzipSync(out);
      } catch {}
    }

    if (serializationMethod === 0b0001) {
      try {
        return JSON.parse(out.toString('utf-8'));
      } catch {
        return null;
      }
    }
    return out;
  }

  private extractTranscript(payload: any): string | null {
    const text = this.extractText(payload);
    if (text && text.trim()) return text.trim();
    return null;
  }

  private extractText(obj: any): string | null {
    if (!obj) return null;
    if (typeof obj.text === 'string') return obj.text;
    const result = Array.isArray(obj.result) ? obj.result : [];
    for (const r of result) {
      if (typeof r?.text === 'string' && r.text.trim()) return r.text;
      const alternatives = Array.isArray(r?.alternatives) ? r.alternatives : [];
      for (const a of alternatives) {
        if (typeof a?.text === 'string' && a.text.trim()) return a.text;
      }
    }
    return null;
  }

  private generateHeader(params: {
    messageType: number;
    messageTypeSpecificFlags: number;
    serializationMethod: number;
    compression: number;
  }) {
    const protocolVersion = 0b0001;
    const headerSize = 0b0001;
    const b0 = (protocolVersion << 4) | headerSize;
    const b1 = (params.messageType << 4) | params.messageTypeSpecificFlags;
    const b2 = (params.serializationMethod << 4) | params.compression;
    const b3 = 0x00;
    return Buffer.from([b0, b1, b2, b3]);
  }
}
