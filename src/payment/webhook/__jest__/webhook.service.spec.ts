import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { type Repository } from 'typeorm';
import { SbpPaymentService } from '../../sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from '../../tinkoff-kassa/tinkoff-kassa.service';
import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
} from '../constants';
import { type KassaNotification } from '../types';
import { WebhookService } from '../webhook.service';

const userRepositoryToken = getRepositoryToken(User) as string;
const paymentRepositoryToken = getRepositoryToken(Payment) as string;
const subscriptionRepositoryToken = getRepositoryToken(Subscription) as string;

const paymentNotification = (
  overrides: Partial<KassaNotification> = {},
): KassaNotification => ({
  TerminalKey: 'terminal-key',
  OrderId: 'payment-id',
  Success: true,
  Status: PAYMENT_NOTIFICATION_STATUSES.NEW,
  PaymentId: 123,
  ErrorCode: '0',
  Amount: 1_000,
  CardId: 456,
  Pan: '430000******0777',
  ExpDate: '1228',
  RebillId: 789,
  Token: 'token',
  ...overrides,
});

describe(WebhookService.name, () => {
  let webhookService: WebhookService;
  let userRepositoryMock: Mocked<Repository<User>>;
  let paymentRepositoryMock: Mocked<Repository<Payment>>;
  let subscriptionRepositoryMock: Mocked<Repository<Subscription>>;
  let sbpPaymentServiceMock: Mocked<SbpPaymentService>;
  let tinkoffKassaServiceMock: Mocked<TinkoffKassaService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(WebhookService)
      .mock(userRepositoryToken)
      .impl(() => ({ update: jest.fn() }))
      .mock(paymentRepositoryToken)
      .impl(() => ({ findOne: jest.fn(), update: jest.fn() }))
      .mock(subscriptionRepositoryToken)
      .impl(() => ({ update: jest.fn() }))
      .mock(SbpPaymentService)
      .impl(() => ({ onAccountLinked: jest.fn() }))
      .mock(TinkoffKassaService)
      .impl(() => ({ checkToken: jest.fn() }))
      .compile();

    webhookService = unit;
    userRepositoryMock = unitRef.get(userRepositoryToken);
    paymentRepositoryMock = unitRef.get(paymentRepositoryToken);
    subscriptionRepositoryMock = unitRef.get(subscriptionRepositoryToken);
    sbpPaymentServiceMock = unitRef.get(SbpPaymentService);
    tinkoffKassaServiceMock = unitRef.get(TinkoffKassaService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    tinkoffKassaServiceMock.checkToken.mockReturnValue(true);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('processNotification', () => {
    it('Должен отклонить уведомление с невалидным токеном', async () => {
      tinkoffKassaServiceMock.checkToken.mockReturnValueOnce(false);

      await expect(
        webhookService.processNotification(paymentNotification()),
      ).rejects.toThrow(BadRequestException);

      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
    });

    it.each([
      ['неуспешного платежа', { Success: false }],
      [
        'платежа со статусом REJECTED',
        { Status: PAYMENT_NOTIFICATION_STATUSES.REJECTED },
      ],
    ])('Должен отклонить уведомление %s', async (_description, overrides) => {
      await webhookService.processNotification(
        paymentNotification(overrides as Partial<KassaNotification>),
      );

      expect(paymentRepositoryMock.update).toHaveBeenCalledWith('payment-id', {
        status: PaymentStatus.REJECTED,
      });
    });

    it('Должен подтвердить платёж, подписку и статус пользователя', async () => {
      const paymentDate = new Date('2026-09-11T08:00:00.000Z');
      jest.useFakeTimers().setSystemTime(paymentDate);
      paymentRepositoryMock.findOne.mockResolvedValueOnce({
        id: 'payment-id',
        subscription_id: 'subscription-id',
        user_id: 'user-id',
        subscription: { plan: SubscriptionPlan.PRO },
      } as Payment);

      await webhookService.processNotification(
        paymentNotification({
          Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
        }),
      );

      expect(paymentRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'payment-id' },
        relations: { subscription: true },
      });
      expect(paymentRepositoryMock.update).toHaveBeenCalledWith('payment-id', {
        status: PaymentStatus.CONFIRMED,
        payment_date: paymentDate,
      });
      expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
        'subscription-id',
        { status: SubscriptionStatus.ACTIVE, rebill_id: 789 },
      );
      expect(userRepositoryMock.update).toHaveBeenCalledWith('user-id', {
        status: UserStatus.SUBSCRIPTION_PRO,
      });
      jest.useRealTimers();
    });

    it('Должен вернуть ошибку, если подтверждаемый платёж не найден', async () => {
      paymentRepositoryMock.findOne.mockResolvedValueOnce(null);

      await expect(
        webhookService.processNotification(
          paymentNotification({
            Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
          }),
        ),
      ).rejects.toThrow(new BadRequestException('Payment not found'));
    });

    it('Должен передать активное уведомление о привязке счёта в СБП', async () => {
      const notification = {
        TerminalKey: 'terminal-key',
        RequestKey: 'request-key',
        Status: LINK_ACCOUNT_NOTIFICATION_STATUSES.ACTIVE,
        Success: true,
        ErrorCode: '0',
        Message: 'OK',
        AccountToken: 'account-token',
        BankMemberId: 'member-id',
        BankMemberName: 'Банк',
        Token: 'token',
        NotificationType: 'LinkAccount',
      };

      await webhookService.processNotification(notification);

      expect(sbpPaymentServiceMock.onAccountLinked).toHaveBeenCalledWith(
        notification,
      );
    });

    it('Не должен менять данные для промежуточного статуса платежа', async () => {
      await webhookService.processNotification(paymentNotification());

      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
      expect(sbpPaymentServiceMock.onAccountLinked).not.toHaveBeenCalled();
    });
  });
});
