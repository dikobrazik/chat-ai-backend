import { Profile, Strategy } from 'passport-google-oauth20';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { OauthProvider } from 'src/entities/OauthAccount';
import { Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService, // private authService: AuthService
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/auth/g`,
      scope: ['email', 'profile'],
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
      OauthProvider.GOOGLE,
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
