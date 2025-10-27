import {
  BadRequestException,
  Body,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, days } from '@nestjs/throttler';
import { User } from '../decorators/user.decorator';
import { User as UserEntity, UserStatus } from '../entities/User';
import { ModelService } from '../model/model.service';
import { ChatService } from './chat.service';
import { CreateChatDTO, PromptDTO, PromptParamsDTO } from './dto';
import { ChatGuard } from './guards/chat.guard';

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
  async getChat(@Param('id') id: string, @User() user: UserEntity) {
    return this.chatService.getChatById(id, user);
  }

  @Post()
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

        return user.status === UserStatus.ACTIVE ? 15 : 5;
      },
    },
  })
  @Post(':id/prompt')
  @UseGuards(ChatGuard)
  async createPrompt(
    @Param() params: PromptParamsDTO,
    @Body() body: PromptDTO,
  ) {
    const chatId = params.id;

    const response = await this.chatService.sendPrompt(body.input, chatId);

    return {
      response: { id: response.id, text: response.text, role: 'model' },
      chatId,
    };
  }
}
