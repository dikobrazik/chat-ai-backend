import { Profile, Strategy } from 'passport-google-oauth20';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { SessionProvider } from '../../entities/Session';
// import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService, // private authService: AuthService
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get('BASE_APP_AUTH_REDIRECT_URL')}/auth/g`,
      scope: ['email', 'profile'],
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
      SessionProvider.GOOGLE,
      profile,
    );
    if (!profile) {
      throw new UnauthorizedException();
    }
    return { user, token };
  }
}
