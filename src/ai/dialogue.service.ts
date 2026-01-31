import {
  BadGatewayException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DialogueMode } from './dto/dialogue-turn.dto';
import { buildSystemPrompt, buildUserPrompt } from './ai_prompts';
import { PrismaService } from '../prisma/prisma.service';

type DialogueTurnResult = {
  mode: DialogueMode;
  inputText: string;
  outputText: string;
  dogEventType?: 'BARK' | 'HOWL' | 'WHINE' | 'GROWL' | 'OTHER';
  confidence?: number;
  raw?: string;
};

@Injectable()
export class DialogueService {
  private readonly apiBase: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    this.apiBase = (process.env.GEMINI3_API_BASE ?? 'http://menshen.xdf.cn/v1').replace(/\/$/, '');
    this.apiKey = process.env.GEMINI3_API_KEY;
    this.model = process.env.GEMINI3_MODEL ?? 'gemini-3.0-pro-preview';
  }

  async turn(params: {
    userId: number;
    mode: DialogueMode;
    inputText: string;
    petId?: number;
    locale?: string;
  }): Promise<DialogueTurnResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException('AI is not configured');
    }

    const system = buildSystemPrompt('dialogue.turn.json', params.locale);
    const pet = params.petId
      ? await this.prisma.pet.findUnique({
          where: { id: params.petId },
          select: { id: true, ownerId: true, name: true, breedId: true },
        })
      : null;

    if (params.petId && !pet) {
      throw new NotFoundException('Pet not found');
    }
    if (pet && pet.ownerId !== params.userId) {
      throw new ForbiddenException('Forbidden');
    }

    const user = buildUserPrompt({
      mode: params.mode,
      inputText: params.inputText,
      petName: pet?.name,
      breedId: pet?.breedId,
    });

    const timeoutMs = 15000;
    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
        signal: abort.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new GatewayTimeoutException('AI request timeout');
      }
      throw new BadGatewayException('AI request failed');
    } finally {
      clearTimeout(t);
    }

    if (!res.ok) {
      throw new BadGatewayException('AI request failed');
    }

    const data = (await res.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('AI response is empty');
    }

    const parsed = this.tryParseJson(content);
    if (parsed) {
      const outputText = typeof parsed.outputText === 'string' ? parsed.outputText : content;
      const dogEventType = this.normalizeDogEventType(parsed.dogEventType);
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
      return {
        mode: params.mode,
        inputText: params.inputText,
        outputText,
        dogEventType,
        confidence,
      };
    }

    return {
      mode: params.mode,
      inputText: params.inputText,
      outputText: content,
      raw: content,
    };
  }

  private tryParseJson(s: string): any | null {
    const trimmed = s.trim();
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

  private normalizeDogEventType(v: any): DialogueTurnResult['dogEventType'] {
    const x = typeof v === 'string' ? v.toUpperCase() : '';
    if (x === 'BARK' || x === 'HOWL' || x === 'WHINE' || x === 'GROWL' || x === 'OTHER') return x as any;
    return undefined;
  }
}
