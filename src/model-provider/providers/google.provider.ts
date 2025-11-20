import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, catchError, throwError } from 'rxjs';
import {
  IModelProvider,
  UnifiedAIStreamChunk,
} from '../model-provider.interface';

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

  async generateStreamResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const stream = await this.providerInstance.models.generateContentStream({
      model,
      contents: input,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        index = 0,
        responseId = '';
      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            const content = chunk.candidates[0].content.parts[0].text;
            if (content) {
              fullContent += content;
              responseId = chunk.responseId;

              subscriber.next({
                promptId: chunk.responseId,
                index: index++,
                content: content,
                isComplete: false,
                timestamp: new Date(),
              });
            }
          }
          subscriber.next({
            promptId: responseId,
            index: -1,
            content: fullContent,
            isComplete: true,
            timestamp: new Date(),
          });
          subscriber.complete();
        } catch (error) {
          subscriber.error({
            content: '',
            isComplete: true,
            timestamp: new Date(),
            error: error.message,
          });
        }
      };
      processStream();
    }).pipe(
      catchError((error) => {
        return throwError(() => ({
          content: '',
          isComplete: true,
          timestamp: new Date(),
          error: error.message,
        }));
      }),
    );
  }
}
