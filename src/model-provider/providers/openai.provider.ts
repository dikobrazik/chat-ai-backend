import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IModelProvider,
  UnifiedAIStreamChunk,
} from '../model-provider.interface';
// import { ResponseStreamEvent } from 'openai/resources/responses/responses';
// import { Stream } from 'openai/core/streaming';
import { Observable, catchError, throwError } from 'rxjs';

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
    conversationId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }> {
    return this.providerInstance.responses
      .create({
        conversation: conversationId,
        model,
        input,
      })
      .then((response) => ({
        id: response.id,
        text: response.output_text,
      }));
  }

  async generateStreamResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const stream = await this.providerInstance.responses.create({
      conversation: conversationId,
      model,
      input,
      stream: true,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'response.created') {
              responseId = chunk.response.id;
              // console.log(chunk);
              // subscriber.next({
              //   type: 'created',
              //   data: {
              //     promptId: chunk.response.id,
              //     content: '',
              //     isComplete: false,
              //     timestamp: new Date(),
              //     index: chunk.sequence_number,
              //     // chatId: conversationId,
              //   },
              // });
            }
            if (chunk.type === 'response.output_text.delta') {
              fullContent += chunk.delta;

              subscriber.next({
                promptId: responseId,
                content: chunk.delta,
                isComplete: false,
                timestamp: new Date(),
                index: chunk.sequence_number,
              });
            }
            if (chunk.type === 'response.completed') {
              subscriber.next({
                index: -1,
                promptId: responseId,
                content: fullContent,
                isComplete: true,
                timestamp: new Date(),
              });
              subscriber.complete();
            }
            if (chunk.type === 'error') {
              subscriber.error({
                isComplete: true,
                timestamp: new Date(),
                error: chunk.message,
              });
            }
          }
        } catch (error) {
          console.log(error);
          subscriber.error({
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
          isComplete: true,
          timestamp: new Date(),
          error: error.message,
        }));
      }),
    );
  }
}
