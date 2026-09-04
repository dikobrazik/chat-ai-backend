import { Inject, Injectable } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailerService {
  @Inject(NestMailerService)
  private readonly mailerService: NestMailerService;

  async sendAuthCode(to: string, code: string) {
    await this.mailerService.sendMail({
      to: to,
      from: process.env.YA_EMAIL,
      subject: 'Your Authentication Code',
      text: `Your authentication code is: ${code}`,
    });
  }

  async sendResetPassword(to: string, code: string) {
    await this.mailerService.sendMail({
      to: to,
      from: process.env.YA_EMAIL,
      subject: 'Password reset',
      html: `<p>To reset your password, please follow the link below:</p>
      <p><a href="${process.env.BASE_APP_URL}/auth/new-password?code=${code}">Reset Password</a></p>
      `,
    });
  }
}
