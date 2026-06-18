import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CompletionCreateParamsStreaming } from 'openai/resources/completions';
import { Observable, catchError, throwError } from 'rxjs';
import {
  IModelProvider,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { BaseProvider } from './base.provider';

@Injectable()
export class DeepSeekProviderService
  extends BaseProvider
  implements IModelProvider
{
  public readonly id = 4;
  public readonly name = 'deepseek';

  private providerInstance: OpenAI;

  constructor(private configService: ConfigService) {
    super();
    const deepSeekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const proxyIpAddress = this.configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new OpenAI({
      baseURL: `http://${proxyIpAddress}/deepseek/chat`,
      apiKey: deepSeekApiKey,
    });
  }

  async createConversation(): Promise<string> {
    return Promise.resolve('deep-seek-conversation-id');
  }

  async generateImageResponse(
    _conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const response = await this.providerInstance.images.generate({
      model,
      prompt: input,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      const imageOutput = response;

      if (!imageOutput) {
        subscriber.error({
          isComplete: true,
          timestamp: new Date(),
          error: 'No image data received from Grok',
        });
        return;
      }

      subscriber.next({
        promptId: response._request_id,
        imageB64: imageOutput.data[0].b64_json,
        isComplete: true,
        timestamp: new Date(),
        index: -1,
      });
    });
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
    chatId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const previousMessages = await this.getPreviousMessages(chatId);

    const stream = await this.providerInstance.completions.create({
      model,
      messages: previousMessages.concat({
        role: 'user',
        content: input,
      }),
      stream: true,
    } as unknown as CompletionCreateParamsStreaming);

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            const response = chunk.choices[0] as any;
            const deltaContent = response.delta.content;

            if (response) {
              responseId = chunk.id;
            }
            if (deltaContent !== null && response.finish_reason === null) {
              fullContent += response.delta.content;

              subscriber.next(
                this.getDeltaPayload(
                  responseId,
                  response.delta.content,
                  response.index,
                ),
              );
            }
            if (response.finish_reason !== null) {
              subscriber.next(this.getCompletePayload(responseId, fullContent));
              subscriber.complete();
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
