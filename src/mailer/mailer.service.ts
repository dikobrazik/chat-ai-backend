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
}
