import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { toFile } from 'openai';
import {
  EasyInputMessage,
  ResponseInputContent,
} from 'openai/resources/responses/responses';
import { Observable, catchError, throwError } from 'rxjs';
import {
  IModelProvider,
  InputFile,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { blobToDataUrl } from 'src/utils/blobToDataUrl';

@Injectable()
export class DeepSeekProviderService implements IModelProvider {
  public readonly id = 4;
  public readonly name = 'deepseek';

  private providerInstance: OpenAI;

  constructor(private configService: ConfigService) {
    const deepSeekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const proxyIpAddress = this.configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new OpenAI({
      baseURL: `http://${proxyIpAddress}/deepseek/beta`,
      apiKey: deepSeekApiKey,
    });
  }

  async createConversation(): Promise<string> {
    // const response = await this.providerInstance.conversations.create();
    // return response.id;
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
    conversationId: string,
    model: string,
    input: string,
    files: InputFile[],
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    // const uploadedFiles: ResponseInputContent[] = await Promise.all(
    //   files.map(async (file) =>
    //     file.mimeType.startsWith('image')
    //       ? {
    //           type: 'input_image',
    //           detail: 'auto',
    //           image_url: await blobToDataUrl(file.blob, file.mimeType),
    //         }
    //       : {
    //           type: 'input_file',
    //           file_id: await this.providerInstance.files
    //             .create({
    //               file: await toFile(file.blob, file.name),
    //               purpose: 'user_data',
    //             })
    //             .then((uploadedFile) => uploadedFile.id),
    //         },
    //   ),
    // );

    const stream = await this.providerInstance.completions.create({
      model,
      prompt: input,
      stream: true,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            console.log(chunk);
            const response = chunk.choices[0];
            if (response) {
              responseId = chunk.id;
            }
            if (response.finish_reason === null) {
              fullContent += response.text;

              subscriber.next({
                promptId: responseId,
                content: response.text,
                isComplete: false,
                timestamp: new Date(),
                index: response.index,
              });
            }
            if (response.finish_reason !== null) {
              subscriber.next({
                index: -1,
                promptId: responseId,
                content: fullContent,
                isComplete: true,
                timestamp: new Date(),
              });
              subscriber.complete();
            }
            // if (chunk.type === 'error') {
            //   subscriber.error({
            //     isComplete: true,
            //     timestamp: new Date(),
            //     error: chunk.message,
            //   });
            // }
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
