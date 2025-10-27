import { Inject, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Session, SessionProvider } from '../entities/Session';
import { Repository } from 'typeorm';
import { Profile as YandexProfile } from 'passport-yandex';
import { Profile as GoogleProfile } from 'passport-google-oauth20';

@Injectable()
export class AuthService {
  @InjectRepository(Session)
  private readonly sessionRepository: Repository<Session>;

  @Inject(UserService)
  private readonly usersService: UserService;
  @Inject(JwtService)
  private readonly jwtService: JwtService;

  async createGuest() {
    const user = await this.usersService.createGuest();

    const token = await this.generateJwtToken(user.id);

    await this.sessionRepository.upsert(
      {
        user_id: user.id,
        provider: SessionProvider.LOCAL,
        provider_user_id: user.id,
      },
      ['user_id'],
    );

    return { user, token };
  }

  async getOrCreate(
    accessToken: string,
    refreshToken: string,
    provider: SessionProvider,
    profile: YandexProfile | GoogleProfile,
  ) {
    const user = await this.usersService.createOrGetUser(
      profile.emails[0].value,
      profile.displayName,
    );

    await this.sessionRepository.upsert(
      {
        user_id: user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date().toJSON(),
        provider,
        provider_user_id: profile.id,
      },
      ['user_id'],
    );

    const token = await this.generateJwtToken(user.id);

    return { user, token };
  }

  public async generateJwtToken(userId: string) {
    return this.jwtService.signAsync({ sub: userId });
  }

  public async validateJwtUser(userId: string) {
    return this.usersService.findById(userId);
  }
}
