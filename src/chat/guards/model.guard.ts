import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User, UserStatus } from '../../entities/User';
import { CreateChatDTO } from '../dto';
import { ModelService } from '../../model/model.service';

const USER_STATUS_LIST = [
  UserStatus.GUEST,
  UserStatus.ACTIVE,
  UserStatus.SUBSCRIPTION_BASE,
  UserStatus.SUBSCRIPTION_PLUS,
  UserStatus.SUBSCRIPTION_PRO,
];

@Injectable()
export class ModelGuard implements CanActivate {
  @Inject(ModelService)
  private readonly modelService: ModelService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const body = request.body as CreateChatDTO;
    const user = request.user as User;

    const model = await this.modelService.getModel(body.model_id);

    return (
      USER_STATUS_LIST.indexOf(user.status) >=
      USER_STATUS_LIST.indexOf(model.available_for_status)
    );
  }
}
