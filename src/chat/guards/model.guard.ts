import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User, UserStatus } from 'src/entities/User';
import { CreateChatDTO } from '../dto';
import { ModelService } from 'src/model/model.service';

const USER_STATUS_LIST = [
  UserStatus.GUEST,
  UserStatus.ACTIVE,
  UserStatus.VERIFIED,
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

    // Guards run before DTO validation.
    if (typeof body.model_id !== 'string' || !body.model_id) {
      throw new BadRequestException('Invalid model ID');
    }

    const model = await this.modelService.getModel(body.model_id);

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    if (
      USER_STATUS_LIST.indexOf(user.status) <
      USER_STATUS_LIST.indexOf(model.available_for_status)
    ) {
      throw new ForbiddenException('Данная модель не доступна на вашем тарифе');
    }

    return true;
  }
}
