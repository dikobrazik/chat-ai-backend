import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider } from '../model-provider.interface';

@Injectable()
export class GoogleProviderService implements IModelProvider {
  public readonly id = 2;
  public readonly name = 'google';

  private providerInstance: GoogleGenAI;

  constructor(private configService: ConfigService) {
    const googleApiKey = configService.get<string>('GOOGLE_API_KEY');
    const proxyIpAddress = configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new GoogleGenAI({
      httpOptions: {
        baseUrl: `http://${proxyIpAddress}/google`,
      },
      apiKey: googleApiKey,
    });
  }

  createConversation(): Promise<string> {
    // const chat = this.providerInstance.chats.create({
    //   model: 'gemini-1.5-turbo',
    // });
    return Promise.resolve('google-conversation-id');
  }

  generateResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }> {
    return this.providerInstance.models
      .generateContent({
        model,
        contents: input,
      })
      .then((response) => ({
        id: response.responseId,
        text: response.text,
      }));
  }

  async canHandle(modelName: string): Promise<boolean> {
    return modelName === 'gemini';
  }
}
