import { Injectable, NotFoundException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Model } from 'src/entities/Model';
import {
  GenerateStreamResponseOptions,
  IModelProvider,
  UnifiedAIStreamChunk,
} from './model-provider.interface';
import { ClaudeProviderService } from './providers/claude.provider';
import { DeepSeekProviderService } from './providers/deepseek.provider';
import { GoogleProviderService } from './providers/google.provider';
import { GrokProviderService } from './providers/grok.provider';
import { OpenAIProviderService } from './providers/openai.provider';

@Injectable()
export class ModelProviderService {
  private readonly providers: IModelProvider[];

  constructor(
    private readonly openAIProviderService: OpenAIProviderService,
    private readonly googleProviderService: GoogleProviderService,
    private readonly grokProviderService: GrokProviderService,
    private readonly deepSeekProviderService: DeepSeekProviderService,
    private readonly claudeProviderService: ClaudeProviderService,
  ) {
    this.providers = [
      this.openAIProviderService,
      this.googleProviderService,
      this.grokProviderService,
      this.deepSeekProviderService,
      this.claudeProviderService,
    ];
  }

  public async generateResponse(
    providerId: number,
    modelName: string,
    prompt: string,
    conversationId?: string,
  ): Promise<{ id: string; text: string }> {
    // Логика выбора Стратегии: ищем провайдера, который может обработать модель
    const provider = this.getProviderById(providerId);

    return provider.generateResponse(conversationId, modelName, prompt);
  }

  public async generateStreamResponse(
    model: Model,
    prompt: string,
    conversationId?: string,
    options?: GenerateStreamResponseOptions,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { provider_id: providerId, name: modelName } = model;
    // Логика выбора Стратегии: ищем провайдера, который может обработать модель
    const provider = this.getProviderById(providerId);

    return provider.generateStreamResponse(
      conversationId,
      modelName,
      prompt,
      options,
    );
  }

  public async generateImageResponse(
    model: Model,
    prompt: string,
    conversationId?: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { provider_id: providerId, name: modelName, for_image } = model;
    // Логика выбора Стратегии: ищем провайдера, который может обработать модель
    const provider = this.getProviderById(providerId);

    if (!for_image) {
      console.warn('Модель не предназначена для генерации изображений.');
      return;
    }

    return provider.generateImageResponse(conversationId, modelName, prompt);
  }

  private getProviderById(providerId: number) {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) {
      throw new NotFoundException(
        `Model provider for provider id ${providerId} not found.`,
      );
    }
    return provider;
  }
}
