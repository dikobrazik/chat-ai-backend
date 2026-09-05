import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { generatePasswordHash } from 'src/utils/generatePasswordHash';
import { EmailAuthDto } from './dtos';
import { UserStatus } from 'src/entities/User';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmailAuthService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(CACHE_MANAGER)
  private readonly cacheManager: Cache;

  public async validateCredentials(body: EmailAuthDto) {
    const user = await this.userService.findByEmail(body.email);

    if (user) {
      if (!user.passwordHash) {
        throw new BadRequestException({
          message:
            'You have not set a password for this email. Please use "Reset password" to log in.',
          code: 'NO_PASSWORD_SET',
          status: 400,
        });
      }

      const isPasswordValid = await bcrypt.compare(
        body.password,
        user.passwordHash,
      );

      if (!isPasswordValid) {
        throw new BadRequestException({
          message: 'Wrong email or password',
          code: 'INVALID_CREDENTIALS',
          status: 400,
        });
      }

      return user;
    }

    return this.userService.saveUser({
      email: body.email,
      passwordHash: await generatePasswordHash(body.password),
      status: UserStatus.ACTIVE,
    });
  }

  public async isRegisteredEmail(email: string) {
    const user = await this.userService.findByEmail(email);

    return {
      isRegistered: Boolean(user),
      hasPassword: Boolean(user && user.passwordHash),
    };
  }

  public async sendAuthCode(email: string) {
    if (this.isDebugEmail(email)) {
      return;
    }

    const authCode = Math.floor(100000 + Math.random() * 900000).toString();

    await this.cacheManager.set(
      this.getAuthCodeCacheKey(email),
      authCode,
      5 * 60 * 1000,
    );

    await this.mailerService.sendAuthCode(email, authCode);
  }

  public async verifyAuthCode(email: string, code: string) {
    if (this.isDebugEmail(email)) {
      return true;
    }

    const authCode = await this.cacheManager.get<string>(
      this.getAuthCodeCacheKey(email),
    );

    if (!authCode || authCode !== code) {
      throw {
        message: 'Invalid auth code',
        code: 'INVALID_AUTH_CODE',
        status: 400,
      };
    }

    await this.userService.saveUser({
      email,
      status: UserStatus.VERIFIED,
      emailVerified: true,
    });

    await this.cacheManager.del(this.getAuthCodeCacheKey(email));

    return true;
  }

  private getAuthCodeCacheKey(email: string): string {
    return `auth-code-${email}`;
  }

  private isDebugEmail(email: string): boolean {
    return (
      this.configService.get('DEBUG_EMAILS_SUFFIX') &&
      email.endsWith(this.configService.get('DEBUG_EMAILS_SUFFIX'))
    );
  }
}
