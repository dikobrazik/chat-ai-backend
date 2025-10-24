import {
  Body,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle, days } from '@nestjs/throttler';
import { User } from '../decorators/user.decorator';
import { User as UserEntity, UserStatus } from '../entities/User';
import { ChatService } from './chat.service';
import { PromptDTO } from './dto';
import { MODELS } from './models';

@Controller('chat')
export class ChatController {
  @Inject(ChatService)
  private readonly chatService: ChatService;

  @Get('models')
  getModels() {
    return MODELS;
  }

  @Get()
  getChats(@User() user: UserEntity) {
    return this.chatService.getUserChats(user);
  }

  @Get(':id')
  getChat(@Param('id') id: string, @User() user: UserEntity) {
    return this.chatService.getChatById(id, user);
  }

  @Throttle({
    default: {
      ttl: days(1),
      limit: (context: ExecutionContext) => {
        const user = context.switchToHttp().getRequest().user as UserEntity;

        return user.status === UserStatus.ACTIVE ? 15 : 5;
      },
    },
  })
  @Post('prompt')
  async createPrompt(@Body() body: PromptDTO, @User() user: UserEntity) {
    let chatId = body.chatId;

    if (!chatId) {
      chatId = (await this.chatService.createChat(user)).identifiers[0].id;
    }

    const response = await this.chatService.sendPrompt(
      body.input,
      chatId,
      body.model,
    );

    return {
      response: { id: response.id, text: response.output_text },
      chatId,
    };
  }
}
