import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Chat } from '../entities/Chat';
import { Prompt } from '../entities/Prompt';
import { ModelProviderService } from '../model-provider/model-provider.service';

@Injectable()
export class ChatTitleGeneratorService {
  @Inject(ModelProviderService)
  private readonly modelProviderService: ModelProviderService;

  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;

  public async createChatTitle(chat: Chat, input: string) {
    const firstMessage = await this.promptRepository.findOne({
      where: {
        chat: { id: chat.id },
        response: Not(IsNull()),
      },
      order: { created_at: 'ASC' },
    });

    const response = await this.modelProviderService.generateResponse(
      1,
      'gpt-4o-mini',
      `На основе первого сообщения из диалога, сгенерируй одно короткое (не более 5 слов) название, которое точно отражает основную тему чата. Название должно быть на русском языке. ${
        firstMessage?.input || input
      }`,
      '',
    );

    await this.chatRepository.update(chat.id, { title: response.text });
  }
}
