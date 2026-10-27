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
import { PromotionService } from 'src/promotion/promotion.service';
import { FIRST_SUBSCRIPTION_PROMOTION_ID } from 'src/promotion/constants';
import { TariffService } from 'src/tariff/tariff.service';
import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
} from '../constants';
import { type KassaNotification } from '../types';
import { WebhookService } from '../webhook.service';

const userRepositoryToken = getRepositoryToken(User) as string;
const paymentRepositoryToken = getRepositoryToken(Payment) as string;
const subscriptionRepositoryToken = getRepositoryToken(Subscription) as string;
const nextChargeAt = new Date('2026-10-11T08:00:00.000Z');

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
  let promotionServiceMock: Mocked<PromotionService>;
  let tariffServiceMock: Mocked<TariffService>;

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
      .mock(PromotionService)
      .impl(() => ({ markPromotionAsUsed: jest.fn() }))
      .mock(TariffService)
      .impl(() => ({ getTariff: jest.fn() }))
      .compile();

    webhookService = unit;
    userRepositoryMock = unitRef.get(userRepositoryToken);
    paymentRepositoryMock = unitRef.get(paymentRepositoryToken);
    subscriptionRepositoryMock = unitRef.get(subscriptionRepositoryToken);
    sbpPaymentServiceMock = unitRef.get(SbpPaymentService);
    tinkoffKassaServiceMock = unitRef.get(TinkoffKassaService);
    promotionServiceMock = unitRef.get(PromotionService);
    tariffServiceMock = unitRef.get(TariffService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    tinkoffKassaServiceMock.checkToken.mockReturnValue(true);
    tariffServiceMock.getTariff.mockResolvedValue({
      nextChargeAt,
    } as Awaited<ReturnType<TariffService['getTariff']>>);
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
        subscription: { plan: SubscriptionPlan.PRO, six_months: true },
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
      expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
        SubscriptionPlan.PRO,
        'user-id',
        true,
      );
      expect(paymentRepositoryMock.update).toHaveBeenCalledWith('payment-id', {
        status: PaymentStatus.CONFIRMED,
        payment_date: paymentDate,
      });
      expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
        'subscription-id',
        {
          status: SubscriptionStatus.ACTIVE,
          rebill_id: 789,
          current_period_start: paymentDate,
          current_period_end: nextChargeAt,
          is_trial: false,
        },
      );
      expect(userRepositoryMock.update).toHaveBeenCalledWith('user-id', {
        status: UserStatus.SUBSCRIPTION_PRO,
      });
      expect(promotionServiceMock.markPromotionAsUsed).toHaveBeenCalledWith(
        FIRST_SUBSCRIPTION_PROMOTION_ID,
        'user-id',
        'payment-id',
      );
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

    it.each([
      [3, true],
      [0, false],
    ])(
      'Должен обновлять признак пробного периода при подтверждении тарифа с %s бесплатными днями',
      async (freeDays, isTrial) => {
        paymentRepositoryMock.findOne.mockResolvedValueOnce(
          Object.assign(new Payment(), {
            id: 'payment-id',
            subscription_id: 'subscription-id',
            user_id: 'user-id',
            subscription: Object.assign(new Subscription(), {
              plan: SubscriptionPlan.PLUS,
              six_months: false,
              is_trial: true,
            }),
          }),
        );
        tariffServiceMock.getTariff.mockResolvedValueOnce({
          id: SubscriptionPlan.PLUS,
          name: 'Плюс',
          description: 'Тестовый тариф',
          price: 19_900,
          features: [],
          freeDays,
          nextChargeAt,
        });

        await webhookService.processNotification(
          paymentNotification({
            Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
          }),
        );

        expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
          'subscription-id',
          expect.objectContaining({ is_trial: isTrial }),
        );
      },
    );

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
