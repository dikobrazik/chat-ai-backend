import { Module } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';
import { GoogleProviderService } from './providers/google.provider';
import { OpenAIProviderService } from './providers/openai.provider';
import { GrokProviderService } from './providers/grok.provider';
import { DeepSeekProviderService } from './providers/deepseek.provider';
import { ClaudeProviderService } from './providers/claude.provider';

@Module({
  providers: [
    ModelProviderService,
    OpenAIProviderService,
    GoogleProviderService,
    GrokProviderService,
    DeepSeekProviderService,
    ClaudeProviderService,
  ],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
