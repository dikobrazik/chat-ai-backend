import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../entities/User';
import { ChatService } from '../chat.service';

@Injectable()
export class ChatGuard implements CanActivate {
  @Inject(ChatService)
  private readonly chatService: ChatService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User;

    const chat = await this.chatService.getChatById(request.params.id);

    await chat.model;

    request.chat = chat;
    request.chatModel = await chat.model;

    return chat.user_id === user.id;
  }
}
