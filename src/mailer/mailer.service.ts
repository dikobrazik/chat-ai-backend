import { Inject, Injectable } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { SubscriptionPlan } from 'src/entities/Subscription';

type ChargeNotificationParams = {
  to: string;
  name?: string | null;
  plan: SubscriptionPlan;
  chargeDate: Date;
  amount: number;
};

const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.BASE]: 'Бесплатный',
  [SubscriptionPlan.PLUS]: 'Плюс',
  [SubscriptionPlan.PRO]: 'Профессиональный',
};

@Injectable()
export class MailerService {
  @Inject(NestMailerService)
  private readonly mailerService: NestMailerService;

  async sendAuthCode(to: string, code: string) {
    await this.mailerService.sendMail({
      to,
      from: process.env.YA_EMAIL,
      subject: 'Код для входа в Jonu',
      text: `Здравствуйте!\n\nВаш код для входа в Jonu: ${code}\n\nНикому не сообщайте этот код. Если вы не запрашивали вход, просто проигнорируйте это письмо.`,
      html: `
      <p>Здравствуйте!</p>
      <p>Используйте этот код, чтобы войти в Jonu:</p>
      <p><strong style="font-size: 24px; letter-spacing: 4px;">${this.escapeHtml(
        code,
      )}</strong></p>
      <p>Никому не сообщайте этот код. Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>
      `,
    });
  }

  async sendResetPassword(to: string, code: string) {
    const resetPasswordUrl = new URL(
      '/auth/new-password',
      process.env.BASE_APP_URL,
    );
    resetPasswordUrl.searchParams.set('code', code);

    await this.mailerService.sendMail({
      to,
      from: process.env.YA_EMAIL,
      subject: 'Восстановление пароля Jonu',
      text: `Здравствуйте!\n\nМы получили запрос на восстановление пароля. Перейдите по ссылке, чтобы задать новый пароль:\n${resetPasswordUrl.toString()}\n\nЕсли вы не запрашивали восстановление, просто проигнорируйте это письмо.`,
      html: `
      <p>Здравствуйте!</p>
      <p>Мы получили запрос на восстановление пароля от аккаунта Jonu.</p>
      <p><a href="${resetPasswordUrl.toString()}">Восстановить пароль</a></p>
      <p>Если вы не запрашивали восстановление, просто проигнорируйте это письмо.</p>
      `,
    });
  }

  async sendChargeNotification({
    to,
    name,
    plan,
    chargeDate,
    amount,
  }: ChargeNotificationParams) {
    const formattedDate = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(chargeDate);
    const formattedAmount = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 2,
    }).format(amount / 100);
    const greeting = name ? `Здравствуйте, ${name}!` : 'Здравствуйте!';

    await this.mailerService.sendMail({
      to,
      from: process.env.YA_EMAIL,
      subject: 'Предстоящее списание за подписку Jonu',
      html: `
      <p>${greeting}</p>
      <p>Напоминаем, что <strong>${formattedDate}</strong> будет списана оплата за подписку Jonu.</p>
      <p>Тариф: <strong>${PLAN_NAMES[plan]}</strong><br>
      Сумма к списанию: <strong>${formattedAmount}</strong></p>
      <p>Если вы не хотите продлевать подписку, отмените её до даты списания в настройках аккаунта.</p>
      `,
    });
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character],
    );
  }
}
