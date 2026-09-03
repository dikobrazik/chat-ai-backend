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
    return Promise.resolve(undefined);
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
    previousInteractionId: string,
    model: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const { files, withThinking, withSearch } = options;

    const uploadedFiles = await Promise.all(
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
            type: 'document' as const,
            uri: uploadedFile.uri,
            mime_type: uploadedFile.mimeType,
          })),
      ),
    );

    const stream = await this.providerInstance.interactions.create({
      model,
      input: [...uploadedFiles, { type: 'text', text: input }],
      previous_interaction_id: previousInteractionId,
      stream: true,
      tools: [{ type: 'google_search', search_types: ['web_search'] }],
      generation_config: {
        max_output_tokens: 15_000,
        thinking_level: withThinking ? 'high' : undefined,
      },
    });

    return new Observable<UnifiedAIStreamChunk>((subscriber) => {
      let fullContent = '',
        index = 0,
        responseId = '',
        isOutputStarted = false;
      const processStream = async () => {
        try {
          for await (const chunk of stream) {
            if (chunk.event_type === 'interaction.created') {
              responseId = chunk.interaction.id;
            }

            if (
              chunk.event_type === 'step.start' &&
              chunk.step.type === 'model_output'
            ) {
              isOutputStarted = true;
            }

            if (isOutputStarted && chunk.event_type === 'step.delta') {
              if (chunk.delta.type === 'text') {
                fullContent += chunk.delta.text;
                subscriber.next(
                  this.getDeltaPayload(responseId, chunk.delta.text, index++),
                );
              }
            }

            if (isOutputStarted && chunk.event_type === 'step.stop') {
              isOutputStarted = false;
            }

            if (chunk.event_type === 'interaction.completed') {
              const usage = chunk.interaction.usage;
              subscriber.next(
                this.getMetaPayload(
                  responseId,
                  usage.total_input_tokens,
                  usage.total_output_tokens,
                  usage.total_thought_tokens,
                ),
              );
              subscriber.next(this.getCompletePayload(responseId, fullContent));
              subscriber.complete();
            }

            if (chunk.event_type === 'error') {
              subscriber.error(this.getErrorPayload(chunk.error.message));
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
