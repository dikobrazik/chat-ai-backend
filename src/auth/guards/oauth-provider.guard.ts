import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
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
    const request = context.switchToHttp().getRequest();
    const { provider } = request.params;
    const strategy = OAUTH_STRATEGIES[provider];

    if (!strategy) {
      throw new NotFoundException('OAuth provider not found');
    }

    if (!request.query.code) {
      const mailingConsent = request.query.mailing_consent;

      if (mailingConsent !== undefined && mailingConsent !== '1') {
        throw new BadRequestException(
          'mailing_consent must be "1" when provided',
        );
      }

      request.session.mailingConsent = mailingConsent === '1';
    }

    return new (AuthGuard(strategy))().canActivate(context);
  }
}
