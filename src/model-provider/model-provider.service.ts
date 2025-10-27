import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IModelProvider } from './model-provider.interface';
import { OpenAIProviderService } from './providers/openai.provider';
import { GoogleProviderService } from './providers/google.provider';

@Injectable()
export class ModelProviderService {
  private readonly providers: IModelProvider[];

  constructor(
    @Inject(OpenAIProviderService)
    private readonly openAIProviderService: OpenAIProviderService,
    @Inject(GoogleProviderService)
    private readonly googleProviderService: GoogleProviderService,
  ) {
    this.providers = [this.openAIProviderService, this.googleProviderService];
  }

  public async createConversation(providerId: number): Promise<string> {
    const provider = this.providers.find((p) => p.id === providerId);

    if (!provider) {
      throw new NotFoundException(`No model providers available.`);
    }

    return provider.createConversation();
  }

  public async generateResponse(
    providerId: number,
    modelName: string,
    query: string,
  ): Promise<{ id: string; text: string }> {
    // Логика выбора Стратегии: ищем провайдера, который может обработать модель
    const provider = this.providers.find((p) => p.id === providerId);

    if (!provider) {
      throw new NotFoundException(
        `Model provider for ${modelName} and provider id ${providerId} not found.`,
      );
    }

    // Делегирование выполнения выбранной Стратегии
    return provider.generateResponse(modelName, query);
  }
}
