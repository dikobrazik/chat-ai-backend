import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from 'src/entities/Chat';
import { Prompt } from 'src/entities/Prompt';
import { ModelProviderModule } from 'src/model-provider/model-provider.module';
import { ModelModule } from 'src/model/model.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGuard } from './guards/chat.guard';
import { ChatTitleGeneratorService } from './chat-title-generator.service';

@Module({
  providers: [ChatTitleGeneratorService, ChatService, ChatGuard],
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
