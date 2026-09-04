import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { generatePasswordHash } from 'src/utils/generatePasswordHash';
import { generateRandomString } from 'src/utils/generateRandomString';
import { PasswordResetVerifyDto } from './dtos';

@Injectable()
export class PasswordResetService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(CACHE_MANAGER)
  private readonly cacheManager: Cache;

  public async sendResetPasswordCode(email: string) {
    if (this.isDebugEmail(email)) {
      return;
    }

    const resetCode = generateRandomString(32);

    await this.cacheManager.set(
      this.getResetCodeCacheKey(resetCode),
      email,
      5 * 60 * 1000,
    );

    await this.mailerService.sendResetPassword(email, resetCode);
  }

  public async verifyResetPasswordCode(params: PasswordResetVerifyDto) {
    const { code, password } = params;

    const email = await this.cacheManager.get<string>(
      this.getResetCodeCacheKey(code),
    );

    if (this.isDebugEmail(email)) {
      return true;
    }

    if (!email) {
      throw {
        message: 'Invalid auth code',
        code: 'INVALID_AUTH_CODE',
        status: 400,
      };
    }

    await Promise.all([
      this.cacheManager.del(this.getResetCodeCacheKey(email)),
      this.userService.saveUser({
        email,
        passwordHash: await generatePasswordHash(password),
        emailVerified: true,
      }),
    ]);
  }

  private getResetCodeCacheKey(email: string): string {
    return `reset-code-${email}`;
  }

  private isDebugEmail(email: string): boolean {
    return (
      this.configService.get('DEBUG_EMAILS_SUFFIX') &&
      email.endsWith(this.configService.get('DEBUG_EMAILS_SUFFIX'))
    );
  }
}
