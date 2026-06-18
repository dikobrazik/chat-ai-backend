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
  IModelProvider,
  InputFile,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { BaseProvider } from './base.provider';
import { blobToBase64 } from 'src/utils/blobToBase64';

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

  async generateImageResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    return Promise.resolve(undefined);
  }

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

  async generateStreamResponse(
    chatId: string,
    model: string,
    input: string,
    files: InputFile[],
  ): Promise<Observable<UnifiedAIStreamChunk>> {
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
      max_tokens: 1024,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            console.log(chunk);

            if (chunk.type === 'message_start') {
              responseId = chunk.message.id;
            }

            if (chunk.type === 'content_block_delta') {
              const deltaContent =
                chunk.delta.type === 'text_delta' ? chunk.delta.text : '';

              fullContent += deltaContent;

              subscriber.next(
                this.getDeltaPayload(responseId, deltaContent, chunk.index),
              );
            }

            if (chunk.type === 'message_stop') {
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
