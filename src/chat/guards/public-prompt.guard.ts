import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/entities/User';
import { PromptService } from '../prompt.service';

@Injectable()
export class PublicPromptGuard implements CanActivate {
  @Inject(PromptService)
  private readonly promptService: PromptService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User;

    const prompt = await this.promptService.getPromptById(request.params.id);

    if (!prompt) {
      return false;
    }

    await prompt.chat;

    return prompt.is_public || prompt.chat.user_id === user.id;
  }
}
