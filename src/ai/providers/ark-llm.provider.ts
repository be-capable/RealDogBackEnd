import { BadGatewayException, GatewayTimeoutException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LlmChatParams, LlmChatResult, LlmProvider } from './provider.types';

@Injectable()
export class ArkLlmProvider implements LlmProvider {
  private readonly apiKey: string | undefined;
  private readonly apiBaseUrl: string;
  private readonly model: string | undefined;

  constructor() {
    const base = (process.env.ARK_API_BASE ?? 'https://ark.cn-beijing.volces.com/api/v3').trim().replace(/\/$/, '');
    this.apiBaseUrl = base;
    this.apiKey = process.env.ARK_API_KEY;
    this.model = process.env.ARK_MODEL_ID;
  }

  async chat(params: LlmChatParams): Promise<LlmChatResult> {
    const stubMode =
      (process.env.AI_STUB_MODE ?? '').trim() === 'true' && (process.env.NODE_ENV ?? '').trim() !== 'production';

    // Intelligent fallback
    const hasValidConfig =
      this.apiKey &&
      !this.apiKey.startsWith('api-key-') && // Check for placeholder
      this.apiKey !== 'replace_me' &&
      this.model &&
      this.model !== 'replace_me';

    if (stubMode || !hasValidConfig) {
      if (!hasValidConfig && !stubMode) {
        // console.warn('LLM config missing or invalid, falling back to stub mode');
      }
      const userText = params.messages?.map((m: any) => String(m?.content ?? '')).join('\n') ?? '';
      const isZh = /[\u4e00-\u9fa5]/.test(userText);
      const content = JSON.stringify({
        meaningText: isZh ? '我在叫：我想引起你的注意。' : "I'm barking: I want your attention.",
        dogEventType: 'OTHER',
        stateType: null,
        contextType: null,
        confidence: 0.2,
        // For synthesis plan
        barkType: 'BARK',
        intensity: 0.8,
        dogText: 'Woooof!',
        transcript: isZh ? '汪汪' : 'Woof!',
      });
      return { content, raw: { stub: true }, vendor: 'stub', model: 'stub' };
    }

    if (!this.apiKey || !this.model) {
      if (!this.apiKey) throw new ServiceUnavailableException('ARK_API_KEY is not configured');
      if (!this.model) throw new ServiceUnavailableException('ARK_MODEL_ID is not configured');
    }

    const timeoutMs = 25000;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);

    let res: any;
    try {
      res = await fetch(`${this.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: params.temperature ?? 0.2,
          messages: params.messages,
        }),
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException('LLM request timeout');
      throw new BadGatewayException('LLM request failed');
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`LLM error ${res.status}: ${text || 'Unknown'}`);
    }

    const data = (await res.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new BadGatewayException('LLM response is empty');

    return {
      content: content.trim(),
      raw: data,
      vendor: 'ark',
      model: this.model,
    };
  }
}
