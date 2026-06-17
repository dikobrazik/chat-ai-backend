import { Anthropic } from '@anthropic-ai/sdk';
import { CompletionCreateParamsStreaming } from '@anthropic-ai/sdk/resources';
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
export class ClaudeProviderService implements IModelProvider {
  public readonly id = 5;
  public readonly name = 'claude';

  private providerInstance: OpenAI;

  constructor(private configService: ConfigService) {
    const claudeApiKey = this.configService.get<string>('CLAUDE_API_KEY');
    const proxyIpAddress = this.configService.get<string>('NGINX_PROXY_IP');

    this.providerInstance = new OpenAI({
      baseURL: `http://${proxyIpAddress}/claude/v1`,
      apiKey: claudeApiKey,
    });

    // const client = new Anthropic({
    //   baseURL: `http://${proxyIpAddress}/claude/v1`,
    //   apiKey: claudeApiKey,
    // })
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
    previousResponseId: string,
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

    const stream = await this.providerInstance.chat.completions.create({
      model,
      messages: [
        {
          content: input,
          role: 'user',
          // type: 'message',
        },
      ],
      stream: true,
      // previous_response_id: previousResponseId,
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        responseId = '';

      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            const response = chunk.choices[0] as any;
            const deltaContent = response.delta.content;
            console.log(chunk, deltaContent);

            if (response) {
              responseId = chunk.id;
            }
            if (Boolean(deltaContent) && !response.finish_reason) {
              fullContent += response.delta.content;

              subscriber.next({
                promptId: responseId,
                content: response.delta.content,
                isComplete: false,
                timestamp: new Date(),
                index: response.index,
              });
            }
            if (Boolean(response.finish_reason)) {
              subscriber.next({
                index: -1,
                promptId: responseId,
                content: fullContent,
                isComplete: true,
                timestamp: new Date(),
              });
              subscriber.complete();
            }

            // if (chunk.type === 'response.created') {
            //   responseId = chunk.response.id;
            // }
            // if (chunk.type === 'response.output_text.delta') {
            //   fullContent += chunk.delta;

            //   subscriber.next({
            //     promptId: responseId,
            //     content: chunk.delta,
            //     isComplete: false,
            //     timestamp: new Date(),
            //     index: chunk.sequence_number,
            //   });
            // }
            // if (chunk.type === 'response.completed') {
            //   subscriber.next({
            //     index: -1,
            //     promptId: responseId,
            //     content: fullContent,
            //     isComplete: true,
            //     timestamp: new Date(),
            //   });
            //   subscriber.complete();
            // }
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
