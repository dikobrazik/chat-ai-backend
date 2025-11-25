import { Profile, Strategy } from 'passport-yandex';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { OauthProvider } from 'src/entities/OauthAccount';
import { Request } from 'express';

@Injectable()
export class YandexStrategy extends PassportStrategy(Strategy, 'yandex', true) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.get('YA_CLIENT_ID'),
      clientSecret: configService.get('YA_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/auth/ya`,
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    providerAccessToken: string,
    providerRefreshToken: string,
    profile: Profile,
  ): Promise<any> {
    console.log(providerAccessToken, providerRefreshToken, profile);

    const user = await this.authService.createUser(
      OauthProvider.YANDEX,
      profile,
      providerAccessToken,
      providerRefreshToken,
    );
    const requestDeviceId = request.cookies['deviceId'];

    const { deviceId, accessToken, refreshToken } =
      await this.authService.createSession(
        user,
        request.clientInfo,
        requestDeviceId,
      );
    if (!profile) {
      throw new UnauthorizedException();
    }
    return [user, { deviceId, accessToken, refreshToken }];
  }
}
