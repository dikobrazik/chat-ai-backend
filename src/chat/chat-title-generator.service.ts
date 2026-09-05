import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from 'src/entities/Chat';
import { ModelProviderService } from 'src/model-provider/model-provider.service';
import { Repository } from 'typeorm';
import { sanitizeTitle } from './utils/sanitize-title';

@Injectable()
export class ChatTitleGeneratorService {
  @Inject(ModelProviderService)
  private readonly modelProviderService: ModelProviderService;

  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;

  public async createChatTitle(chat: Chat, input: string) {
    const response = await this.modelProviderService.generateResponse(
      1,
      'gpt-4o-mini',
      `На основе первого сообщения из диалога, сгенерируй одно короткое (не более 5 слов, не используй любые кавычки) название, которое точно отражает основную тему чата. Название должно быть на русском языке. Вот первое сообщение - "${input}"`,
      '',
    );

    await this.chatRepository.update(chat.id, {
      title: sanitizeTitle(response.text),
    });
  }
}
