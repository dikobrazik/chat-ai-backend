import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { map, tap } from 'rxjs';
import { IsNull, Not, Repository } from 'typeorm';
import { Chat } from '../entities/Chat';
import { Prompt } from '../entities/Prompt';
import { User } from '../entities/User';
import { ModelProviderService } from '../model-provider/model-provider.service';
import { ModelService } from '../model/model.service';
import { Model } from 'src/entities/Model';

@Injectable()
export class ChatService {
  @Inject(ModelProviderService)
  private readonly modelProviderService: ModelProviderService;
  @Inject(ModelService)
  private readonly modelService: ModelService;

  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;

  public async createChat(user: User, model_id: number) {
    const model = await this.modelService.getModel(model_id);

    const conversationId = await this.modelProviderService.createConversation(
      model.provider_id,
    );

    const chat = await this.chatRepository.insert({
      model_id: model.id,
      external_chat_id: conversationId,
      user_id: user.id,
    });

    return chat;
  }

  public async sendPrompt(chat: Chat, model: Model, input: string) {
    const response = await this.modelProviderService.generateResponse(
      model.provider_id,
      model.name,
      input,
      chat.external_chat_id,
    );

    await this.promptRepository.insert({
      input,
      chat,
      response: response.text,
    });

    return response;
  }

  public async sendStreamPrompt(chat: Chat, model: Model, input: string) {
    const stream = await this.modelProviderService.generateStreamResponse(
      model,
      input,
      chat.external_chat_id,
    );

    const pipedStream = stream.pipe(
      map((chunk) => ({
        type: chunk.index === -1 ? 'complete' : 'delta',
        data: chunk,
      })),
      tap(async (streamChunk) => {
        if (streamChunk.data.isComplete) {
          await this.promptRepository.insert({
            input,
            chat,
            response: streamChunk.data.content,
          });
        }
      }),
    );

    return pipedStream;
  }

  public async getUserChats(user: User) {
    return await this.chatRepository.find({
      where: { user_id: user.id, last_prompt: Not(IsNull()) },
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
      })
    )
      .map((prompt) => [
        { id: prompt.id, text: prompt.response, role: 'model' },
        { id: `user-${prompt.id}`, text: prompt.input, role: 'user' },
      ])
      .flat();
  }
}
