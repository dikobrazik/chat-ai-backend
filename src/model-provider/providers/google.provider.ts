import { GoogleGenAI, Part } from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Observable, catchError, throwError } from 'rxjs';
import {
  GenerateStreamResponseOptions,
  IModelProvider,
  UnifiedAIStreamChunk,
} from 'src/model-provider/model-provider.interface';
import { BaseProvider } from './base.provider';

@Injectable()
export class GoogleProviderService
  extends BaseProvider
  implements IModelProvider
{
  public readonly id = 2;
  public readonly name = 'google';

  private providerInstance: GoogleGenAI;

  constructor(private configService: ConfigService) {
    super();

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

  async generateImageResponse(
    conversationId: string,
    model: string,
    input: string,
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const response = await this.providerInstance.models.generateImages({
      model,
      prompt: input,
      config: {
        numberOfImages: 1,
      },
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      const image = response.generatedImages[0];
      if (!image) {
        subscriber.error(
          this.getErrorPayload('No image data received from Google GenAI'),
        );
        return;
      }

      subscriber.next(
        this.getImagePayload(image.image.gcsUri, image.image.imageBytes),
      );
    });
  }

  async generateStreamResponse(
    conversationId: string,
    model: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { files, withThinking } = options;

    const uploadedFiles: Part[] = await Promise.all(
      files.map((file) =>
        this.providerInstance.files
          .upload({
            file: file.blob,
            config: {
              mimeType: file.mimeType,
              displayName: file.name,
              name: randomUUID(),
            },
          })
          .then((uploadedFile) => ({
            fileData: {
              fileUri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
            },
          })),
      ),
    );

    const stream = await this.providerInstance.models.generateContentStream({
      model,
      contents: [...uploadedFiles, input],
      config: {
        thinkingConfig: withThinking
          ? {
              includeThoughts: true,
            }
          : undefined,
      },
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        index = 0,
        responseId = '';
      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            const content = chunk.candidates[0].content.parts[0].text;
            const isThought = chunk.candidates[0].content.parts[0].thought;

            if (content) {
              responseId = chunk.responseId;

              if (isThought) {
                subscriber.next(
                  this.getThinkingPayload(responseId, content, index++),
                );
              } else {
                fullContent += content;
                subscriber.next(
                  this.getDeltaPayload(responseId, content, index++),
                );
              }
            }
          }
          subscriber.next(this.getCompletePayload(responseId, fullContent));
          subscriber.complete();
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
}
