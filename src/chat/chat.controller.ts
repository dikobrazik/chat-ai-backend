import {
  BadRequestException,
  Body,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle, days } from '@nestjs/throttler';
import { User } from '../decorators/user.decorator';
import { User as UserEntity, UserStatus } from '../entities/User';
import { ModelService } from '../model/model.service';
import { ChatService } from './chat.service';
import { CreateChatDTO, PromptDTO, PromptParamsDTO } from './dto';
import { ChatGuard } from './guards/chat.guard';
import { ModelGuard } from './guards/model.guard';
import { Chat } from 'src/decorators/chat.decorator';
import { Chat as ChatEntity } from 'src/entities/Chat';
import { ChatModel } from 'src/decorators/chat-model.decorator';
import { Model } from 'src/entities/Model';

const USER_STATUS_LIMITS = {
  [UserStatus.ACTIVE]: 15,
  [UserStatus.GUEST]: 5,
  [UserStatus.SUBSCRIPTION_BASE]: 0,
  [UserStatus.SUBSCRIPTION_PLUS]: 0,
  [UserStatus.SUBSCRIPTION_PRO]: 0,
};

@Controller('chat')
export class ChatController {
  @Inject(ChatService)
  private readonly chatService: ChatService;
  @Inject(ModelService)
  private readonly modelService: ModelService;

  @Get()
  getChats(@User() user: UserEntity) {
    return this.chatService.getUserChats(user);
  }

  @Get(':id')
  @UseGuards(ChatGuard)
  async getChat(
    @Param('id') id: string,
    @Chat() chat: ChatEntity,
    @ChatModel() model: Model,
  ) {
    const prompts = await this.chatService.getChatPrompts(id);
    return { chat: { id: chat.id, model }, prompts };
  }

  @Post()
  @UseGuards(ModelGuard)
  async createChat(@User() user: UserEntity, @Body() body: CreateChatDTO) {
    const model = await this.modelService.getModel(body.model_id ?? 1);

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    return (await this.chatService.createChat(user, body.model_id))
      .identifiers[0].id;
  }

  @Throttle({
    prompt: {
      ttl: days(1),
      limit: (context: ExecutionContext) => {
        const user = context.switchToHttp().getRequest().user as UserEntity;

        return USER_STATUS_LIMITS[user.status];
      },
    },
  })
  @Post(':id/prompt')
  @UseGuards(ChatGuard)
  async createPrompt(
    @Param() params: PromptParamsDTO,
    @Body() body: PromptDTO,
    @Chat() chat: ChatEntity,
    @ChatModel() model: Model,
  ) {
    const chatId = params.id;

    const response = await this.chatService.sendPrompt(chat, model, body.input);

    return {
      response: { id: response.id, text: response.text, role: 'model' },
      chatId,
    };
  }

  @Throttle({
    prompt: {
      ttl: days(1),
      limit: (context: ExecutionContext) => {
        const user = context.switchToHttp().getRequest().user as UserEntity;

        return USER_STATUS_LIMITS[user.status];
      },
    },
  })
  @Sse(':id/prompt-stream')
  @UseGuards(ChatGuard)
  async createPromptStream(
    @Query() body: PromptDTO,
    @Chat() chat: ChatEntity,
    @ChatModel() model: Model,
  ) {
    const stream = await this.chatService.sendStreamPrompt(
      chat,
      model,
      body.input,
    );

    return stream;
  }
}
