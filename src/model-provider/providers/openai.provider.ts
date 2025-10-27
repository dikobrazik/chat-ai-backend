import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { IModelProvider } from '../model-provider.interface';

@Injectable()
export class OpenAIProviderService implements IModelProvider {
  public readonly id = 1;
  public readonly name = 'openai';

  private providerInstance: OpenAI;

  constructor(private configService: ConfigService) {
    const openAiApiKey = configService.get<string>('OPEN_AI_API_KEY');
    const proxyIpAddress = configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new OpenAI({
      baseURL: `http://${proxyIpAddress}/openai/v1`,
      apiKey: openAiApiKey,
    });
  }

  async createConversation(): Promise<string> {
    const response = await this.providerInstance.conversations.create();
    return response.id;
  }

  generateResponse(
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }> {
    return this.providerInstance.responses
      .create({
        model,
        input,
      })
      .then((response) => ({
        id: response.id,
        text: response.output_text,
      }));
  }

  async canHandle(modelName: string): Promise<boolean> {
    return modelName === 'gemini';
  }
}
