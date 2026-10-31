import { Module } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';
import { GoogleProviderService } from './providers/google.provider';
import { OpenAIProviderService } from './providers/openai.provider';
import { GrokProviderService } from './providers/grok.provider';
import { DeepSeekProviderService } from './providers/deepseek.provider';
import { ClaudeProviderService } from './providers/claude.provider';
import { AlibabaProviderService } from './providers/alibaba.provider';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prompt } from 'src/entities/Prompt';
import { FileStorageModule } from 'src/file-storage/file-storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Prompt]), FileStorageModule],
  providers: [
    ModelProviderService,
    OpenAIProviderService,
    GoogleProviderService,
    GrokProviderService,
    DeepSeekProviderService,
    ClaudeProviderService,
    AlibabaProviderService,
  ],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
