import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from 'src/entities/Chat';
import { Model } from 'src/entities/Model';
import { Prompt } from 'src/entities/Prompt';
import { User } from 'src/entities/User';
import { ModelProviderService } from 'src/model-provider/model-provider.service';
import { Not, Repository } from 'typeorm';

@Injectable()
export class ChatService {
  @Inject(ModelProviderService)
  private readonly modelProviderService: ModelProviderService;
  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;

  public async createChat(user: User, model: Model) {
    const {
      identifiers: [{ id }],
    } = await this.chatRepository.insert({
      model_id: model.id,
      external_chat_id: undefined,
      user_id: user.id,
    });

    return id;
  }

  public getUserChats(user: User) {
    return this.chatRepository.find({
      where: { user_id: user.id, has_prompt: true, title: Not('') },
      order: { created_at: 'DESC' },
      relations: ['model'],
    });
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

  public async updateChat(
    id: string,
    chat: Partial<Omit<Chat, 'id' | 'user_id' | 'model_id'>>,
  ) {
    await this.chatRepository.save({ ...chat, id });
  }

  public async makeChatPublic(chat: Chat) {
    chat.is_public = true;
    await this.chatRepository.save(chat);
  }

  public async deleteChat(chat: Chat) {
    await this.chatRepository.remove(chat);
  }
}
