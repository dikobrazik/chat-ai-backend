import { Profile, Strategy } from 'passport-yandex';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { SessionProvider } from '../../entities/Session';

@Injectable()
export class YandexStrategy extends PassportStrategy(Strategy, 'yandex', true) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.get('YA_CLIENT_ID'),
      clientSecret: configService.get('YA_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_APP_AUTH_REDIRECT_URL')}/auth/ya`,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<any> {
    console.log(accessToken, refreshToken, profile);
    const { user, token } = await this.authService.getOrCreate(
      accessToken,
      refreshToken,
      SessionProvider.YANDEX,
      profile,
    );
    if (!profile) {
      throw new UnauthorizedException();
    }
    return { user, token };
  }
}
