import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { OpenAIProvider } from './providers/openai.provider';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from '../entities/Chat';
import { Prompt } from '../entities/Prompt';
import { GoogleGenAIProvider } from './providers/google.provider';

@Module({
  providers: [ChatService, OpenAIProvider, GoogleGenAIProvider],
  imports: [TypeOrmModule.forFeature([Chat, Prompt])],
  controllers: [ChatController],
})
export class ChatModule {}
