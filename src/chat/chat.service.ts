import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from 'src/entities/Chat';
import { Model } from 'src/entities/Model';
import { User } from 'src/entities/User';
import { Not, Repository } from 'typeorm';

@Injectable()
export class ChatService {
  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;

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
      order: { is_pinned: 'DESC', created_at: 'DESC' },
      relations: ['model'],
    });
  }

  public getChatById(id: string) {
    return this.chatRepository.findOne({
      where: { id },
      relations: ['model'],
    });
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
