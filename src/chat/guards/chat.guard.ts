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

  canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User;

    return this.chatService.getIsUsersChat(request.params.id, user);
  }
}
