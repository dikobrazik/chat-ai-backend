import { Inject, Injectable } from '@nestjs/common';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenAI } from 'openai';
import { InjectRepository } from '@nestjs/typeorm';
import { Chat } from '../entities/Chat';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../entities/User';
import { Prompt } from '../entities/Prompt';
import { GoogleGenAIProvider } from './providers/google.provider';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class ChatService {
  @Inject(OpenAIProvider.provide)
  private openAI: OpenAI;
  @Inject(GoogleGenAIProvider.provide)
  private googleGenAI: GoogleGenAI;

  @InjectRepository(Chat)
  private readonly chatRepository: Repository<Chat>;
  @InjectRepository(Prompt)
  private readonly promptRepository: Repository<Prompt>;

  public async createChat(user: User) {
    const conversation = await this.openAI.conversations.create({});

    const chat = await this.chatRepository.insert({
      external_chat_id: conversation.id,
      user,
    });

    return chat;
  }

  public async sendPrompt(
    input: string,
    chatId: string,
    model = 'gpt-4o-mini',
  ) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });

    const response = await this.openAI.responses.create({
      model,
      input,
      // max_output_tokens: 100,
      conversation: chat.external_chat_id,
    });

    await this.promptRepository.insert({
      input,
      chat,
      response: response.output_text,
    });

    return response;
  }

  public async getUserChats(user: User) {
    console.log((await this.openAI.chat.completions.list()).data);

    return await this.chatRepository.find({
      where: { user_id: user.id, last_prompt: Not(IsNull()) },
      order: { created_at: 'DESC' },
    });
  }

  public async getChatById(id: string, user: User) {
    return (
      await this.promptRepository.find({
        where: { chat: { id, user_id: user.id } },
        order: { created_at: 'DESC' },
      })
    )
      .map((prompt) => [prompt.response, prompt.input])
      .flat();
  }
}
