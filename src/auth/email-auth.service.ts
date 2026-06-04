import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { EmailAuthDto } from './dtos';

@Injectable()
export class EmailAuthService {
  @Inject(ConfigService)
  private readonly configService: ConfigService;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MailerService)
  private readonly mailerService: MailerService;

  private readonly authCodes = new Map<string, string>();

  public async createUser(body: EmailAuthDto) {
    const user = await this.userService.findByEmail(body.email);

    const hasUser = !!user;
    const hasPassword = hasUser && !!user.passwordHash;

    if (user) {
      const isPasswordValid =
        hasPassword && (await bcrypt.compare(body.password, user.passwordHash));

      if (!isPasswordValid) {
        throw new BadRequestException({
          message: 'Wrong email or password',
          code: 'INVALID_CREDENTIALS',
          status: 400,
        });
      }
    } else {
      await this.userService.createUser({
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 10),
        emailVerified: false,
      });
    }
  }

  public async sendAuthCode(email: string) {
    if (this.isDebugEmail(email)) {
      return;
    }

    const authCode = Math.floor(100000 + Math.random() * 900000).toString();

    this.authCodes.set(email, authCode);

    await this.mailerService.sendAuthCode(email, authCode);
  }

  public async verifyAuthCode(email: string, code: string) {
    if (this.isDebugEmail(email)) {
      return true;
    }

    const authCode = this.authCodes.get(email);

    if (!authCode || authCode !== code) {
      throw {
        message: 'Invalid auth code',
        code: 'INVALID_AUTH_CODE',
        status: 400,
      };
    }

    this.authCodes.delete(email);

    return true;
  }

  private isDebugEmail(email: string): boolean {
    return (
      this.configService.get('DEBUG_EMAILS_SUFFIX') &&
      email.endsWith(this.configService.get('DEBUG_EMAILS_SUFFIX'))
    );
  }
}
