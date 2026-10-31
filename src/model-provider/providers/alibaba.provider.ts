import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import {
  ChatCompletionContentPartImage,
  ChatCompletionContentPartText,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat/completions';
import { ResponseInput } from 'openai/resources/responses/responses';
import { filter, lastValueFrom, Observable } from 'rxjs';
import { Prompt } from 'src/entities/Prompt';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import {
  ALIBABA_IMAGE_MODELS,
  ALIBABA_TEXT_MODELS,
  AlibabaImageModel,
  AlibabaTextModel,
} from 'src/model-provider/alibaba-models';
import {
  GenerateStreamResponseOptions,
  IModelProvider,
  InputFile,
  UnifiedAIStreamChunk,
  UnifiedAIStreamChunkMain,
} from 'src/model-provider/model-provider.interface';
import { blobToDataUrl } from 'src/utils/blobToDataUrl';
import { Repository } from 'typeorm';
import { AlibabaImageClient } from './alibaba-image.client';
import { BaseProvider } from './base.provider';

type UserContent = (
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
)[];
type ConversationMessage =
  | { role: 'user'; content: string | UserContent }
  | { role: 'assistant'; content: string };

@Injectable()
export class AlibabaProviderService
  extends BaseProvider
  implements IModelProvider
{
  public readonly id = 6;
  public readonly name = 'alibaba';

  @InjectRepository(Prompt)
  private readonly historyRepository: Repository<Prompt>;

  @Inject(FileStorageService)
  private readonly fileStorageService: FileStorageService;

  private readonly providerInstance: OpenAI;
  private readonly apiKey: string;
  private readonly dashScopeBaseURL: string | undefined;

  constructor(configService: ConfigService) {
    super();
    this.apiKey = configService.getOrThrow<string>('ALIBABA_API_KEY');
    const baseURL = configService.getOrThrow<string>('ALIBABA_BASE_URL');
    this.providerInstance = new OpenAI({ apiKey: this.apiKey, baseURL });
    this.dashScopeBaseURL =
      configService.get<string>('ALIBABA_DASHSCOPE_BASE_URL') ||
      (/\/compatible-mode\/v1\/?$/.test(baseURL)
        ? baseURL.replace(/\/compatible-mode\/v1\/?$/, '/api/v1')
        : undefined);
  }

  private async imageParts(files: InputFile[]): Promise<UserContent> {
    if (files.some((file) => !file.mimeType.startsWith('image/'))) {
      throw new BadRequestException(
        'Alibaba vision models accept only image attachments',
      );
    }
    return Promise.all(
      files.map(
        async (file): Promise<ChatCompletionContentPartImage> => ({
          type: 'image_url',
          image_url: { url: await blobToDataUrl(file.blob, file.mimeType) },
        }),
      ),
    );
  }

  private async getMessages(
    chatId: string,
    input: string,
    files: InputFile[],
    model: AlibabaTextModel,
  ): Promise<ConversationMessage[]> {
    if (files.length && !model.vision) {
      throw new BadRequestException(
        `${model.name} does not support image attachments`,
      );
    }
    const messages: ConversationMessage[] = [];
    if (chatId) {
      const prompts = await this.historyRepository.find({
        where: { chat_id: chatId },
        order: { created_at: 'ASC', id: 'ASC' },
        ...(model.vision ? { relations: { files: true } } : {}),
      });
      for (const prompt of prompts) {
        const historyFiles =
          model.vision && prompt.files?.length
            ? await this.fileStorageService.getFilesByIds(
                prompt.files.map((file) => file.file_id),
              )
            : [];
        messages.push(
          {
            role: 'user',
            content: historyFiles.length
              ? [
                  { type: 'text', text: prompt.input },
                  ...(await this.imageParts(historyFiles)),
                ]
              : prompt.input,
          },
          { role: 'assistant', content: prompt.response },
        );
      }
    }
    messages.push({
      role: 'user',
      content: files.length
        ? [{ type: 'text', text: input }, ...(await this.imageParts(files))]
        : input,
    });
    return messages;
  }

  async generateResponse(
    chatId: string,
    model: string,
    input: string,
  ): Promise<{ id: string; text: string }> {
    const stream = await this.generateStreamResponse(chatId, model, input);
    const response = await lastValueFrom(
      stream.pipe(
        filter(
          (chunk): chunk is UnifiedAIStreamChunkMain =>
            chunk.type === 'complete',
        ),
      ),
    );
    return { id: response.promptId, text: response.content };
  }

  async generateImageResponse(
    _chatId: string,
    modelName: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const model = ALIBABA_IMAGE_MODELS.find((item) => item.name === modelName);
    if (!model) {
      throw new NotFoundException(`Alibaba image model ${modelName} not found`);
    }
    if (!this.dashScopeBaseURL) {
      throw new Error(
        'Set ALIBABA_DASHSCOPE_BASE_URL to the regional /api/v1 endpoint for image generation',
      );
    }
    const client = new AlibabaImageClient(this.apiKey, this.dashScopeBaseURL);
    return this.observe((signal) =>
      this.streamImage(client, model, input, options.files ?? [], signal),
    );
  }

  private async *streamImage(
    client: AlibabaImageClient,
    model: AlibabaImageModel,
    input: string,
    files: InputFile[],
    signal: AbortSignal,
  ): AsyncGenerator<UnifiedAIStreamChunk> {
    const result = await client.generate(model, input, files, signal);
    yield this.getImagePayload(result.id, result.imageB64);
  }

  async generateStreamResponse(
    chatId: string,
    modelName: string,
    input: string,
    options: GenerateStreamResponseOptions = {},
  ): Promise<Observable<UnifiedAIStreamChunk>> {
    const model = ALIBABA_TEXT_MODELS.find((item) => item.name === modelName);
    if (!model) {
      throw new NotFoundException(`Alibaba text model ${modelName} not found`);
    }
    if (options.withThinking && !model.thinking) {
      throw new BadRequestException(`${modelName} does not support thinking`);
    }
    if (options.withSearch && !model.search) {
      throw new BadRequestException(`${modelName} does not support web search`);
    }
    const messages = await this.getMessages(
      chatId,
      input,
      options.files ?? [],
      model,
    );
    if (options.withSearch && model.search === 'responses') {
      return this.observe((signal) =>
        this.streamResponses(model, messages, options, signal),
      );
    }
    const request: ChatCompletionCreateParamsStreaming & {
      enable_thinking?: boolean;
      enable_search?: boolean;
    } = {
      model: modelName,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(model.thinking === 'optional'
        ? { enable_thinking: options.withThinking ?? false }
        : {}),
      ...(model.thinking === 'effort'
        ? { reasoning_effort: options.withThinking ? 'high' : 'none' }
        : {}),
      ...(model.search === 'chat'
        ? { enable_search: options.withSearch ?? false }
        : {}),
      ...(model.omni ? { modalities: ['text'] } : {}),
    };
    return this.observe((signal) => this.streamChat(request, signal));
  }

  private async *streamChat(
    request: ChatCompletionCreateParamsStreaming,
    signal: AbortSignal,
  ): AsyncGenerator<UnifiedAIStreamChunk> {
    const stream = await this.providerInstance.chat.completions.create(
      request,
      { signal },
    );
    let fullContent = '';
    let responseId = '';
    let finished = false;
    for await (const chunk of stream) {
      responseId = chunk.id;
      const choice = chunk.choices[0];
      if (choice) {
        const { delta } = choice;
        if (
          'reasoning_content' in delta &&
          typeof delta.reasoning_content === 'string' &&
          delta.reasoning_content
        ) {
          yield this.getThinkingPayload(
            responseId,
            delta.reasoning_content,
            choice.index,
          );
        }
        if (delta.content) {
          fullContent += delta.content;
          yield this.getDeltaPayload(responseId, delta.content, choice.index);
        }
        if (choice.finish_reason === 'content_filter') {
          throw new Error('Alibaba blocked the response with a content filter');
        }
        if (choice.finish_reason != null) {
          finished = true;
        }
      }
      if (chunk.usage) {
        yield this.getMetaPayload(
          responseId,
          chunk.usage.prompt_tokens,
          chunk.usage.completion_tokens,
          chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0,
        );
      }
    }
    if (!finished) {
      throw new Error('Alibaba stream ended before completion');
    }
    yield this.getCompletePayload(responseId, fullContent);
  }

  private async *streamResponses(
    model: AlibabaTextModel,
    messages: ConversationMessage[],
    options: GenerateStreamResponseOptions,
    signal: AbortSignal,
  ): AsyncGenerator<UnifiedAIStreamChunk> {
    const input: ResponseInput = messages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : message.content.map((part) =>
              part.type === 'text'
                ? { type: 'input_text' as const, text: part.text }
                : {
                    type: 'input_image' as const,
                    image_url: part.image_url.url,
                    detail: 'auto' as const,
                  },
            ),
    }));
    const stream = await this.providerInstance.responses.create(
      {
        model: model.name,
        input,
        stream: true,
        tools: [{ type: 'web_search' }],
        reasoning: { effort: options.withThinking ? 'high' : 'none' },
      },
      { signal },
    );
    let fullContent = '';
    let responseId = '';
    for await (const chunk of stream) {
      if (chunk.type === 'response.created') {
        responseId = chunk.response.id;
      } else if (chunk.type === 'response.output_text.delta') {
        fullContent += chunk.delta;
        yield this.getDeltaPayload(
          responseId,
          chunk.delta,
          chunk.sequence_number,
        );
      } else if (
        chunk.type === 'response.reasoning_summary_text.delta' ||
        chunk.type === 'response.reasoning_text.delta'
      ) {
        yield this.getThinkingPayload(
          responseId,
          chunk.delta,
          chunk.sequence_number,
        );
      } else if (chunk.type === 'response.completed') {
        const usage = chunk.response.usage;
        responseId = chunk.response.id;
        if (usage) {
          yield this.getMetaPayload(
            responseId,
            usage.input_tokens,
            usage.output_tokens,
            usage.output_tokens_details?.reasoning_tokens ?? 0,
          );
        }
        yield this.getCompletePayload(responseId, fullContent);
        return;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.message);
      } else if (
        chunk.type === 'response.failed' ||
        chunk.type === 'response.incomplete'
      ) {
        throw new Error(
          chunk.response.error?.message ||
            `Alibaba response ${chunk.response.status}`,
        );
      }
    }
    throw new Error('Alibaba stream ended before completion');
  }

  private observe(
    generate: (signal: AbortSignal) => AsyncIterable<UnifiedAIStreamChunk>,
  ): Observable<UnifiedAIStreamChunk> {
    return new Observable((subscriber) => {
      const controller = new AbortController();
      const process = async () => {
        try {
          for await (const chunk of generate(controller.signal)) {
            if (subscriber.closed) {
              return;
            }
            subscriber.next(chunk);
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(
            this.getErrorPayload(
              error instanceof Error ? error.message : String(error),
            ),
          );
        }
      };
      void process();
      return () => controller.abort();
    });
  }
}
