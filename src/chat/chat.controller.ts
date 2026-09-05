import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatModel } from 'src/decorators/chat-model.decorator';
import { Chat } from 'src/decorators/chat.decorator';
import { User } from 'src/decorators/user.decorator';
import { Chat as ChatEntity } from 'src/entities/Chat';
import { Model } from 'src/entities/Model';
import { User as UserEntity } from 'src/entities/User';
import { ModelService } from 'src/model/model.service';
import { ChatService } from './chat.service';
import { CreateChatDTO, PatchChatDto } from './dto';
import { ChatGuard } from './guards/chat.guard';
import { ModelGuard } from './guards/model.guard';
import { PublicChatGuard } from './guards/public-chat.guard';

@Controller('chat')
export class ChatController {
  @Inject(ChatService)
  private readonly chatService: ChatService;
  @Inject(ModelService)
  private readonly modelService: ModelService;

  @Post()
  @UseGuards(ModelGuard)
  async createChat(@User() user: UserEntity, @Body() body: CreateChatDTO) {
    const model = await this.modelService.getModel(body.model_id);

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    return this.chatService.createChat(user, model);
  }

  @Get()
  getChatsList(@User() user: UserEntity) {
    return this.chatService.getUserChats(user);
  }

  // TODO: разнести на 2 метода
  @Get(':id')
  @UseGuards(PublicChatGuard)
  async getChat(
    @Param('id') id: string,
    @Chat() chat: ChatEntity,
    @ChatModel() model: Model,
  ) {
    return {
      id,
      model,
      title: chat.title,
      is_public: chat.is_public,
      is_pinned: chat.is_pinned,
      model_id: chat.model_id,
    };
  }

  @Patch(':id')
  @UseGuards(PublicChatGuard)
  async patchChat(@Param('id') id: string, @Body() body: PatchChatDto) {
    await this.chatService.updateChat(id, body);
  }

  @Patch(':id/public')
  @UseGuards(ChatGuard)
  async makeChatPublic(@Chat() chat: ChatEntity) {
    await this.chatService.makeChatPublic(chat);
  }

  @Delete(':id')
  @UseGuards(ChatGuard)
  async deleteChat(@Chat() chat: ChatEntity) {
    await this.chatService.deleteChat(chat);
  }
}
