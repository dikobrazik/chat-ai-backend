import {
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
import { Throttle, hours } from '@nestjs/throttler';
import { Request } from 'express';
import { ChatModel } from 'src/decorators/chat-model.decorator';
import { Chat } from 'src/decorators/chat.decorator';
import { Chat as ChatEntity } from 'src/entities/Chat';
import { Model } from 'src/entities/Model';
import { User as UserEntity, UserStatus } from 'src/entities/User';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { PromptDTO } from './dto';
import { ChatGuard } from './guards/chat.guard';
import { PromptGuard } from './guards/prompt.guard';
import { PromptService } from './prompt.service';
import { PublicChatGuard } from './guards/public-chat.guard';
import { PublicPromptGuard } from './guards/public-prompt.guard';

const USER_STATUS_LIMITS = {
  [UserStatus.GUEST]: 5,
  [UserStatus.ACTIVE]: 5,
  [UserStatus.VERIFIED]: 15,
  [UserStatus.SUBSCRIPTION_PLUS]: 100000,
  [UserStatus.SUBSCRIPTION_PRO]: 100000,
};

@Controller('chat')
export class PromptController {
  @Inject(PromptService)
  private readonly promptService: PromptService;
  @Inject(FileStorageService)
  private readonly fileStorageService: FileStorageService;

  @Throttle({
    prompt: {
      ttl: hours(12),
      limit: (context: ExecutionContext) => {
        const user = context.switchToHttp().getRequest().user as UserEntity;

        return USER_STATUS_LIMITS[user.status];
      },
      getTracker: (req: Request) => {
        return `${req.user?.id}-${req.params.id}`;
      },
    },
  })
  @Sse(':id/prompt-stream')
  @UseGuards(ChatGuard, PromptGuard)
  async createPromptStream(
    @Query() body: PromptDTO,
    @Chat() chat: ChatEntity,
    @ChatModel() model: Model,
  ) {
    const stream = await this.promptService.sendStreamPrompt(chat, model, body);

    return stream;
  }

  @Get(':id/prompt/:promptId/image')
  @UseGuards(ChatGuard)
  async getPromptImageURL(
    @Param('id') id: string,
    @Param('promptId') promptId: string,
  ) {
    const promptImageURL = await this.fileStorageService.getPromptImageUrl(
      id,
      promptId,
    );
    return promptImageURL;
  }

  @Get(':id/prompt')
  @UseGuards(PublicChatGuard)
  async getChatPrompts(@Param('id') id: string) {
    return this.promptService.getChatPrompts(id);
  }

  @Post(':id/prompt/:promptId/public')
  @UseGuards(PublicChatGuard)
  async makePromptPublic(@Param('promptId') promptId: string) {
    await this.promptService.makePromptPublic(promptId);
  }

  @Get(':id/prompt/:promptId')
  @UseGuards(PublicPromptGuard)
  async getPromptById(@Param('promptId') promptId: string) {
    const { chat, ...prompt } = await this.promptService.getPromptById(
      promptId,
    );

    return prompt;
  }
}
