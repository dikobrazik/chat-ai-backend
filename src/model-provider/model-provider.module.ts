import { Module } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';
import { GoogleProviderService } from './providers/google.provider';
import { OpenAIProviderService } from './providers/openai.provider';

@Module({
  providers: [
    ModelProviderService,
    OpenAIProviderService,
    GoogleProviderService,
  ],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
