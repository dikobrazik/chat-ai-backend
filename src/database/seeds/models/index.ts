import { CLAUDE_MODELS } from './claude/models.seed';
import { DEEPSEEK_MODELS } from './deepseek/models.seed';
import { GOOGLE_MODELS } from './google/models.seed';
import { GROK_MODELS } from './grok/models.seed';
import { OPENAI_MODELS } from './openai/models.seed';

export const SEED_MODELS = [
  ...OPENAI_MODELS,
  ...GOOGLE_MODELS,
  ...GROK_MODELS,
  ...DEEPSEEK_MODELS,
  ...CLAUDE_MODELS,
];
