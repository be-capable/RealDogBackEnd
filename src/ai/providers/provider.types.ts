export type AudioFormat = 'wav' | 'mp3';

export type AsrTranscribeParams = {
  audioBytes: Uint8Array;
  format: AudioFormat;
  locale?: string;
  traceId?: string;
  uid?: string;
};

export type AsrTranscribeResult = {
  text: string;
  raw?: unknown;
  vendor?: string;
  model?: string;
};

export interface AsrProvider {
  transcribe(params: AsrTranscribeParams): Promise<AsrTranscribeResult>;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmChatParams = {
  messages: ChatMessage[];
  temperature?: number;
  traceId?: string;
};

export type LlmChatResult = {
  content: string;
  raw?: unknown;
  vendor?: string;
  model?: string;
};

export interface LlmProvider {
  chat(params: LlmChatParams): Promise<LlmChatResult>;
}

export type TtsSynthesizeParams = {
  text: string;
  locale?: string;
  uid?: string;
  traceId?: string;
};

export type TtsSynthesizeResult = {
  bytes: Uint8Array;
  ext: 'mp3' | 'wav';
  raw?: unknown;
  vendor?: string;
  model?: string;
};

export interface TtsProvider {
  synthesize(params: TtsSynthesizeParams): Promise<TtsSynthesizeResult>;
}

