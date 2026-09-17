import { TestBed, type Mocked } from '@suites/unit';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { MailerService } from '../mailer.service';

describe(MailerService.name, () => {
  let mailerService: MailerService;
  let nestMailerServiceMock: Mocked<NestMailerService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(MailerService)
      .mock(NestMailerService)
      .impl(() => ({ sendMail: jest.fn() }))
      .compile();

    mailerService = unit;
    nestMailerServiceMock = unitRef.get(NestMailerService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.BASE_APP_URL = 'https://jonu.ru';
  });

  it('Должен отправить русскоязычное письмо с кодом для входа', async () => {
    await mailerService.sendAuthCode('user@example.com', '123456');

    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Код для входа в Jonu',
        text: expect.stringContaining('Ваш код для входа в Jonu: 123456'),
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('Должен отправить русскоязычное письмо со ссылкой на восстановление пароля', async () => {
    await mailerService.sendResetPassword('user@example.com', 'code&token');

    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Восстановление пароля Jonu',
        text: expect.stringContaining(
          'https://jonu.ru/auth/new-password?code=code%26token',
        ),
        html: expect.stringContaining(
          'https://jonu.ru/auth/new-password?code=code%26token',
        ),
      }),
    );
  });

  it('Должен отправить персональное уведомление о предстоящем списании', async () => {
    await mailerService.sendChargeNotification({
      to: 'user@example.com',
      name: 'Ильнар',
      plan: SubscriptionPlan.PLUS,
      chargeDate: new Date('2026-09-20T08:00:00.000Z'),
      amount: 1_000,
    });

    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Предстоящее списание за подписку Jonu',
        html: expect.stringContaining('Здравствуйте, Ильнар!'),
      }),
    );
    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('20 сентября 2026 г.'),
      }),
    );
    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Плюс'),
      }),
    );
    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('10,00 ₽'),
      }),
    );
  });

  it('Должен использовать нейтральное обращение без имени', async () => {
    await mailerService.sendChargeNotification({
      to: 'user@example.com',
      plan: SubscriptionPlan.PRO,
      chargeDate: new Date('2026-09-20T08:00:00.000Z'),
      amount: 2_000,
    });

    expect(nestMailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Здравствуйте!</p>'),
      }),
    );
  });
});
