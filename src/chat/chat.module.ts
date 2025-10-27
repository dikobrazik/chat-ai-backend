import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from '../entities/Chat';
import { Prompt } from '../entities/Prompt';
import { ModelProviderModule } from '../model-provider/model-provider.module';
import { ModelModule } from '../model/model.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGuard } from './guards/chat.guard';

@Module({
  providers: [ChatService, ChatGuard],
  imports: [
    ChatModule,
    TypeOrmModule.forFeature([Chat, Prompt]),
    ModelModule,
    ModelProviderModule,
  ],
  exports: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
