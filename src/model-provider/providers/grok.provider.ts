import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import {
  EasyInputMessage,
  ResponseInputContent,
} from 'openai/resources/responses/responses';
import { Observable, catchError, throwError } from 'rxjs';
import {
  GenerateStreamResponseOptions,
  IModelProvider,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { blobToDataUrl } from 'src/utils/blobToDataUrl';
import { BaseProvider } from './base.provider';

@Injectable()
export class GrokProviderService
  extends BaseProvider
  implements IModelProvider
{
  public readonly id = 3;
  public readonly name = 'grok';

  private providerInstance: OpenAI;

  constructor(private configService: ConfigService) {
    super();

    const grokApiKey = this.configService.get<string>('GROK_API_KEY');
    const proxyIpAddress = this.configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new OpenAI({
      baseURL: `http://${proxyIpAddress}/grok/v1`,
      apiKey: grokApiKey,
    });
  }

  async createConversation(): Promise<string> {
    return Promise.resolve(undefined);
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
          this.getErrorPayload('No image data received from Grok'),
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
    previousResponseId: string,
    model: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { files } = options;

    const uploadedFiles: ResponseInputContent[] = await Promise.all(
      files.map(async (file) =>
        file.mimeType.startsWith('image')
          ? {
              type: 'input_image',
              detail: 'auto',
              image_url: await blobToDataUrl(file.blob, file.mimeType),
            }
          : {
              type: 'input_file',
              file_id: await this.providerInstance.files
                .create({
                  file: await toFile(file.blob, file.name),
                  purpose: 'user_data',
                })
                .then((uploadedFile) => uploadedFile.id),
            },
      ),
    );

    const stream = await this.providerInstance.responses.create({
      model,
      input: [
        {
          content: [{ type: 'input_text', text: input }, ...uploadedFiles],
          role: 'user',
          type: 'message',
        },
      ] as EasyInputMessage[],
      stream: true,
      previous_response_id: previousResponseId,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'response.created') {
              responseId = chunk.response.id;
            }
            if (chunk.type === 'response.output_text.delta') {
              fullContent += chunk.delta;

              subscriber.next(
                this.getDeltaPayload(
                  responseId,
                  chunk.delta,
                  chunk.sequence_number,
                ),
              );
            }
            if (chunk.type === 'response.completed') {
              subscriber.next(this.getCompletePayload(fullContent, responseId));
              subscriber.complete();
            }
            if (chunk.type === 'error') {
              subscriber.error(this.getErrorPayload(chunk.message));
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
}
