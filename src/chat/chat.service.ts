import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { filter, map, mergeMap, tap } from 'rxjs';
import { IsNull, Not, Repository } from 'typeorm';
import { Chat } from 'src/entities/Chat';
import { Prompt } from 'src/entities/Prompt';
import { User } from 'src/entities/User';
import { ModelProviderService } from 'src/model-provider/model-provider.service';
import { ModelService } from 'src/model/model.service';
import { Model } from 'src/entities/Model';
import { ChatTitleGeneratorService } from './chat-title-generator.service';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { PromptFile } from 'src/entities/PromptFile';
import {
  UnifiedAIStreamChunk,
  UnifiedAIStreamChunkMain,
} from 'src/model-provider/model-provider.interface';
import { PromptDTO } from './dto';
import { PromptMeta } from 'src/entities/PromptMeta';

@Injectable()
export class ChatService {
  @Inject(ModelProviderService)
  private readonly modelProviderService: ModelProviderService;
  @Inject(ModelService)
  private readonly modelService: ModelService;
  @Inject(ChatTitleGeneratorService)
  private readonly chatTitleGeneratorService: ChatTitleGeneratorService;
  @Inject(FileStorageService)
  private readonly fileStorageService: FileStorageService;

  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;
  @InjectRepository(PromptFile)
  private readonly promptFileRepository: Repository<PromptFile>;
  @InjectRepository(PromptMeta)
  private readonly promptMetaRepository: Repository<PromptMeta>;

  public async createChat(user: User, model_id: number) {
    const model = await this.modelService.getModel(model_id);

    const conversationId = await this.modelProviderService.createConversation(
      model.provider_id,
    );

    const {
      identifiers: [{ id }],
    } = await this.chatRepository.insert({
      model_id: model.id,
      external_chat_id: conversationId,
      user_id: user.id,
    });

    return id;
  }

  public async sendStreamPrompt(chat: Chat, model: Model, options: PromptDTO) {
    const {
      files_ids,
      with_search = false,
      with_thinking = false,
      input,
    } = options;

    // todo: добавить проверку прав
    const files = await this.fileStorageService.getFilesByIds(files_ids);

    if (!chat.title) {
      await this.chatTitleGeneratorService.createChatTitle(chat, input);
    }

    if (model.for_image) {
      return this.sendImagePrompt(chat, model, input);
    }

    let conversationId = chat.external_chat_id;

    // если провайдер grok или google - передаем id последнего промпта
    if (model.provider_id === 3 || model.provider_id === 2) {
      const lastPrompt = await this.promptRepository.findOne({
        select: { response_id: true },
        where: { chat_id: chat.id },
        order: { created_at: 'desc' },
      });

      if (lastPrompt) {
        conversationId = lastPrompt.response_id;
      }
    } else if (model.provider_id === 4 || model.provider_id === 5) {
      conversationId = chat.id;
    }

    const stream = await this.modelProviderService.generateStreamResponse(
      model,
      input,
      conversationId,
      { files, withSearch: with_search, withThinking: with_thinking },
    );

    const pipedStream = stream.pipe(
      tap(async (chunk) => {
        if (chunk.type === 'meta') {
          await this.promptMetaRepository.insert({
            prompt_id: chunk.promptId,
            input_tokens: chunk.inputTokens ?? 0,
            output_tokens: chunk.outputTokens ?? 0,
            thinking_tokens: chunk.thinkingTokens ?? 0,
          });
        }
      }),
      filter<UnifiedAIStreamChunk, UnifiedAIStreamChunkMain>(
        (chunk): chunk is UnifiedAIStreamChunkMain => chunk.type !== 'meta',
      ),
      map((chunk) => ({
        type: chunk.type,
        data: chunk,
      })),
      tap(async (streamChunk) => {
        if (streamChunk.type === 'complete') {
          const {
            identifiers: [{ id: promptId }],
          } = await this.promptRepository.insert({
            input: input,
            chat,
            response_id: streamChunk.data.promptId,
            response: streamChunk.data.content,
          });

          if (files_ids) {
            for (const fileId of files_ids) {
              this.promptFileRepository.save([
                {
                  file_id: fileId,
                  prompt_id: promptId,
                },
              ]);
            }
          }
        }
      }),
    );

    return pipedStream;
  }

  private async sendImagePrompt(chat: Chat, model: Model, input: string) {
    const stream = await this.modelProviderService.generateImageResponse(
      model,
      input,
      chat.external_chat_id,
    );

    return stream.pipe(
      filter<UnifiedAIStreamChunk, UnifiedAIStreamChunkMain>(
        (chunk): chunk is UnifiedAIStreamChunkMain => chunk.type !== 'meta',
      ),
      map((chunk) => ({
        type: chunk.type,
        data: chunk,
      })),
      mergeMap(async (streamChunk) => {
        const {
          identifiers: [{ id }],
        } = await this.promptRepository.insert({
          input,
          chat,
          response: '[Image response]',
          is_image: true,
        });

        await this.fileStorageService.saveGeneratedImage(
          id,
          chat.id,
          streamChunk.data.imageB64,
        );

        streamChunk.data.promptId = id;
        streamChunk.data.imageB64 = null;
        streamChunk.data.content = `[Image response]`;

        return streamChunk;
      }),
    );
  }

  public async getUserChats(user: User) {
    return await this.chatRepository.find({
      where: { user_id: user.id, has_prompt: true, title: Not('') },
      order: { created_at: 'DESC' },
      relations: ['model'],
    });
  }

  public async getIsUsersChat(id: string, user: User) {
    return (
      (
        await this.chatRepository.findOne({
          where: { id },
        })
      ).user_id === user.id
    );
  }

  public getChatById(id: string) {
    return this.chatRepository.findOne({
      where: { id },
      relations: ['model'],
    });
  }

  public async getChatPrompts(
    id: string,
  ): Promise<{ id: string; text: string; role: string }[]> {
    return (
      await this.promptRepository.find({
        where: { chat: { id } },
        order: { created_at: 'DESC' },
        relations: { files: { file: true } },
      })
    )
      .map((prompt) => [
        { id: prompt.id, text: prompt.response, role: 'model' },
        {
          id: `user-${prompt.id}`,
          text: prompt.input,
          role: 'user',
          files: prompt.files?.map((promptFile) => ({
            id: promptFile.file.id,
            name: promptFile.file.name,
            size: promptFile.file.size,
            type: promptFile.file.type,
          })),
        },
      ])
      .flat();
  }

  public async makeChatPublic(chat: Chat) {
    chat.is_public = true;
    await this.chatRepository.save(chat);
  }

  public async deleteChat(chat: Chat) {
    await this.chatRepository.remove(chat);
  }
}
