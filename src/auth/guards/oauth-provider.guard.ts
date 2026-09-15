import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const OAUTH_STRATEGIES = {
  google: 'google',
  yandex: 'yandex',
  vk: 'vkontakte',
  mailru: 'mailru',
  ok: 'odnoklassniki',
} as const;

@Injectable()
export class OauthProviderGuard implements CanActivate {
  public canActivate(context: ExecutionContext) {
    const { provider } = context.switchToHttp().getRequest().params;
    const strategy = OAUTH_STRATEGIES[provider];

    if (!strategy) {
      throw new NotFoundException('OAuth provider not found');
    }

    return new (AuthGuard(strategy))().canActivate(context);
  }
}
