import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CompletionCreateParamsStreaming } from 'openai/resources/completions';
import { Observable, catchError, throwError } from 'rxjs';
import {
  GenerateStreamResponseOptions,
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
        subscriber.error(
          this.getErrorPayload('No image data received from DeepSeek'),
        );
        return;
      }

      subscriber.next(
        this.getImagePayload(
          response._request_id,
          imageOutput.data[0].b64_json,
        ),
      );
    });
  }

  async generateStreamResponse(
    chatId: string,
    model: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { withThinking } = options;

    const previousMessages = await this.getPreviousMessages(chatId);

    const stream = await this.providerInstance.completions.create({
      model,
      messages: previousMessages.concat({
        role: 'user',
        content: input,
      }),
      stream: true,
      max_tokens: 15_000,
      thinking: withThinking ? { type: 'enabled' } : undefined,
    } as unknown as CompletionCreateParamsStreaming);

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            const response = chunk.choices[0] as any;
            const deltaContent = response.delta.content;
            const deltaReasoningContent = response.delta.reasoning_content;

            if (response) {
              responseId = chunk.id;
            }

            if (deltaReasoningContent !== null) {
              subscriber.next(
                this.getThinkingPayload(
                  responseId,
                  deltaReasoningContent,
                  response.index,
                ),
              );
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
              subscriber.next(
                this.getMetaPayload(
                  responseId,
                  chunk.usage.prompt_tokens,
                  chunk.usage.completion_tokens,
                  chunk.usage.completion_tokens_details.reasoning_tokens,
                ),
              );
              subscriber.next(this.getCompletePayload(responseId, fullContent));
              subscriber.complete();
            }
          }
        } catch (error) {
          subscriber.error(this.getErrorPayload(error.message));
        }
      };

      processStream();
    }).pipe(
      catchError((error) => {
        return throwError(() => this.getErrorPayload(error.message));
      }),
    );
  }

  /**
   * @deprecated This method is deprecated and will be removed in future versions. Use generateStreamResponse instead.
   * @param conversationId
   * @param model
   * @param input
   * @returns
   */
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
}
