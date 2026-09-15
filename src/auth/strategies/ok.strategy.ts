import { Profile, Strategy } from 'passport-ok-strategy';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from 'src/auth/auth.service';
import { OauthProvider } from 'src/entities/OauthAccount';
import { Request } from 'express';

@Injectable()
export class OkStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.get('VK_CLIENT_ID'),
      clientSecret: configService.get('VK_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_URL')}/auth/ok/callback`,
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
    const user = await this.authService.createUser(
      OauthProvider.OK,
      profile,
      providerAccessToken,
      providerRefreshToken,
    );

    if (!profile) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
