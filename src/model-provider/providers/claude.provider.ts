import { Anthropic } from '@anthropic-ai/sdk';
import {
  Base64ImageSource,
  ContentBlockParam,
  Message,
} from '@anthropic-ai/sdk/resources';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, catchError, throwError } from 'rxjs';
import {
  GenerateStreamResponseOptions,
  IModelProvider,
  InputFile,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { blobToBase64 } from 'src/utils/blobToBase64';
import { BaseProvider } from './base.provider';

@Injectable()
export class ClaudeProviderService
  extends BaseProvider
  implements IModelProvider
{
  public readonly id = 5;
  public readonly name = 'claude';

  private providerInstance: Anthropic;

  constructor(private configService: ConfigService) {
    super();

    const claudeApiKey = this.configService.get<string>('CLAUDE_API_KEY');
    const proxyIpAddress = this.configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new Anthropic({
      baseURL: `http://${proxyIpAddress}/claude`,
      apiKey: claudeApiKey,
    });
  }

  async createConversation(): Promise<string> {
    return Promise.resolve(undefined);
  }

  async generateImageResponse(): Promise<Observable<UnifiedAIStreamChunk>> {
    return Promise.resolve(undefined);
  }

  async generateStreamResponse(
    chatId: string,
    model: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { files, withThinking, withSearch } = options;

    const uploadedFiles: ContentBlockParam[] = await this.prepareFiles(files);

    const previousMessages = await this.getPreviousMessages(chatId);

    const stream = await this.providerInstance.messages.create({
      model,
      messages: previousMessages.concat([
        {
          content: [{ type: 'text', text: input }, ...uploadedFiles],
          role: 'user',
        },
      ]),
      stream: true,
      max_tokens: 15_000,
      tool_choice: withSearch
        ? { type: 'tool', name: 'web_search' }
        : { type: 'auto' },
      tools: [
        { type: 'web_search_20250305', name: 'web_search' },
        { type: 'web_search_20260209', name: 'web_search' },
      ],
      thinking: withThinking
        ? { budget_tokens: 1024, type: 'enabled' }
        : undefined,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'message_start') {
              responseId = chunk.message.id;
            }

            if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta') {
                const deltaContent = chunk.delta.text;

                fullContent += deltaContent;

                subscriber.next(
                  this.getDeltaPayload(responseId, deltaContent, chunk.index),
                );
              } else if (chunk.delta.type === 'thinking_delta') {
                subscriber.next(
                  this.getThinkingPayload(
                    responseId,
                    chunk.delta.thinking,
                    chunk.index,
                  ),
                );
              }
            }

            if (chunk.type === 'message_delta') {
              subscriber.next(
                this.getMetaPayload(
                  responseId,
                  chunk.usage.input_tokens,
                  chunk.usage.output_tokens,
                  chunk.usage.output_tokens_details.thinking_tokens,
                ),
              );
            }

            if (chunk.type === 'message_stop') {
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

  private prepareFiles(
    files: InputFile[],
  ): Promise<Anthropic.Messages.ContentBlockParam[]> {
    return Promise.all(
      files.map(async (file) =>
        file.mimeType.startsWith('image')
          ? ({
              type: 'image',
              source: {
                type: 'base64',
                data: await blobToBase64(file.blob),
                media_type: file.mimeType as Base64ImageSource['media_type'],
              },
            } as ContentBlockParam)
          : ({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: await blobToBase64(file.blob),
              },
            } as ContentBlockParam),
      ),
    );
  }

  /**
   * @deprecated This method is deprecated and will be removed in future versions. Use generateStreamResponse instead.
   * @param conversationId
   * @param model
   * @param input
   * @returns
   */
  async generateResponse(
    chatId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }> {
    const previousMessages = await this.getPreviousMessages(chatId);

    return this.providerInstance.messages
      .create({
        model,
        messages: previousMessages.concat({
          role: 'user',
          content: input,
        }),
        max_tokens: 1024,
      })
      .then((message) => ({
        id: message.id,
        text: this.getMessageText(message),
      }));
  }

  private getMessageText(message: Message) {
    const textContent = message.content.find(
      (contentBlock) => contentBlock.type === 'text',
    );

    if (textContent.type === 'text') {
      return textContent.text;
    }

    return '';
  }
}
