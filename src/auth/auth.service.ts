import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile as YandexProfile } from 'passport-yandex';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { OauthAccount, OauthProvider } from 'src/entities/OauthAccount';
import { User } from 'src/entities/User';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { SessionService } from 'src/session/session.service';

export const ACCESS_TOKEN_EXPIRES_IN = '30seconds'; // '1minutes';
export const REFRESH_TOKEN_EXPIRES_IN = '60days';

@Injectable()
export class AuthService {
  @InjectRepository(OauthAccount)
  private readonly oauthAccountRepository: Repository<OauthAccount>;

  @Inject(SessionService)
  private readonly sessionService: SessionService;
  @Inject(UserService)
  private readonly usersService: UserService;
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  async createUser(
    provider: OauthProvider,
    profile: YandexProfile | GoogleProfile,
    accessToken: string,
    refreshToken: string,
  ) {
    const user = await this.usersService.createUser({
      email: profile.emails[0].value,
      name: profile.displayName,
      photo: profile.photos?.[0]?.value,
    });

    await this.oauthAccountRepository.upsert(
      {
        user_id: user.id,
        provider,
        provider_user_id: profile.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        // todo: calculate expires_at based on provider data
        expires_at: new Date(),
      },
      ['user_id'],
    );

    return user;
  }

  async createSession(
    user: User,
    clientInfo: Request['clientInfo'],
    requestDeviceId: string,
  ) {
    const accessToken = await this.generateJwtToken(
      user.id,
      ACCESS_TOKEN_EXPIRES_IN,
    );
    const refreshToken = await this.generateJwtToken(
      user.id,
      REFRESH_TOKEN_EXPIRES_IN,
    );

    const deviceId = requestDeviceId || randomUUID();

    await this.sessionService.createSession(
      user.id,
      clientInfo,
      deviceId,
      refreshToken,
    );

    return { deviceId, accessToken, refreshToken };
  }

  public async generateJwtToken(
    userId: string,
    expiresIn: JwtSignOptions['expiresIn'],
  ) {
    return this.jwtService.signAsync(
      { sub: userId },
      { expiresIn: expiresIn || '7d' },
    );
  }

  public async validateRefreshToken(token: string, deviceId: string) {
    try {
      await this.jwtService.verifyAsync(token, {
        ignoreExpiration: false,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Refresh token is expired',
          error: 'refresh_token_expired',
        });
      }

      throw new UnauthorizedException({
        message: 'Token is invalid',
        error: 'refresh_token_invalid',
      });
    }

    const session = await this.sessionService.getSession(token, deviceId);

    if (!session) {
      throw new UnauthorizedException({
        message: 'Where is no such session',
        error: 'no_session',
      });
    }

    return { userId: session.user_id };
  }
}
