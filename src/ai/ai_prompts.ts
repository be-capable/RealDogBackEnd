import { DialogueMode } from './dto/dialogue-turn.dto';

export type AiPromptScenario = 'dialogue.turn.json';

export function buildSystemPrompt(scenario: AiPromptScenario, locale?: string): string {
  const lang = locale?.startsWith('zh') ? 'zh-CN' : 'en';

  if (lang === 'zh-CN') {
    return [
      '你是 RealDog 的“人狗对话翻译器”。',
      '你要把“狗叫”翻译成人类能理解的中文；把人类说话翻译成“狗叫风格的文字”。',
      '输出必须是 JSON，不要包含 markdown，不要包含额外说明。',
      'JSON schema: {"outputText": string, "dogEventType": "BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER", "confidence": number}',
      'confidence 取 0~1，小数。',
      'dogEventType 用最接近的类型；如果不确定用 OTHER。',
      '狗叫文字风格要求：短句、拟声词（汪/呜/嗷/呜咽）、情绪标签（如【兴奋】）可选，但不要太长。',
    ].join('\n');
  }

  return [
    'You are RealDog dialogue translator.',
    'Translate dog vocalizations into concise human-readable text; translate human speech into dog-style textual barks.',
    'Output MUST be JSON only (no markdown).',
    'JSON schema: {"outputText": string, "dogEventType": "BARK"|"HOWL"|"WHINE"|"GROWL"|"OTHER", "confidence": number}',
    'confidence is 0~1 float. dogEventType choose closest; if unsure use OTHER.',
    'Dog-style output should be short, onomatopoeia, optional emotion tag like [excited].',
  ].join('\n');
}

export function buildUserPrompt(params: {
  mode: DialogueMode;
  inputText: string;
  petName?: string;
  breedId?: string;
}): string {
  const ctx =
    params.petName || params.breedId
        ? `Pet context:\n- name: ${params.petName ?? ''}\n- breedId: ${params.breedId ?? ''}\n`
        : '';

  if (params.mode === DialogueMode.DOG_TO_HUMAN) {
    return `DOG_TO_HUMAN\n${ctx}Input (dog sound or description):\n${params.inputText}`;
  }
  return `HUMAN_TO_DOG\n${ctx}Input (human speech):\n${params.inputText}`;
}
