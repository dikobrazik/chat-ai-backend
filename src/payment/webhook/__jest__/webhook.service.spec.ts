import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, Logger } from '@nestjs/common';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { In, type Repository } from 'typeorm';
import { SbpPaymentService } from '../../sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from '../../tinkoff-kassa/tinkoff-kassa.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { FIRST_SUBSCRIPTION_PROMOTION_ID } from 'src/promotion/constants';
import { TariffService } from 'src/tariff/tariff.service';
import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
  RECEIPT_NOTIFICATION_STATUSES,
} from '../constants';
import { type KassaNotification } from '../types';
import { WebhookService } from '../webhook.service';
import { createReceiptNotification as receiptNotification } from '../../../../test/payment/fixtures';

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
    paymentRepositoryMock.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
    tariffServiceMock.getTariff.mockResolvedValue({
      nextChargeAt,
    } as Awaited<ReturnType<TariffService['getTariff']>>);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
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
      const paymentDate = new Date('2026-09-11T08:00:00.000Z');
      jest.useFakeTimers().setSystemTime(paymentDate);
      await webhookService.processNotification(
        paymentNotification(overrides as Partial<KassaNotification>),
      );

      expect(paymentRepositoryMock.update).toHaveBeenCalledWith(
        {
          id: 'payment-id',
          status: In([PaymentStatus.NEW, PaymentStatus.FORM_SHOWN]),
        },
        { status: PaymentStatus.REJECTED, payment_date: paymentDate },
      );
    });

    it('Должен сохранять ссылку из RECEIPT без изменения статуса платежа и подписки', async () => {
      const notification = receiptNotification();

      await webhookService.processNotification(notification);

      expect(tinkoffKassaServiceMock.checkToken).toHaveBeenCalledWith(
        notification,
      );
      expect(paymentRepositoryMock.update).toHaveBeenCalledTimes(1);
      expect(paymentRepositoryMock.update).toHaveBeenCalledWith('payment-id', {
        receipt_url: notification.Url,
      });
      expect(subscriptionRepositoryMock.update).not.toHaveBeenCalled();
      expect(userRepositoryMock.update).not.toHaveBeenCalled();
      expect(tariffServiceMock.getTariff).not.toHaveBeenCalled();
      expect(promotionServiceMock.markPromotionAsUsed).not.toHaveBeenCalled();
      expect(sbpPaymentServiceMock.onAccountLinked).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it('Не должен отклонять платёж при ошибке фискализации', async () => {
      await webhookService.processNotification(
        receiptNotification({ Success: false, ErrorCode: '123' }),
      );

      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
      expect(subscriptionRepositoryMock.update).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Fiscalization failed for payment payment-id: 123',
      );
    });

    it.each([undefined, null])(
      'Не должен очищать существующий чек при отсутствии ссылки (%s)',
      async (Url) => {
        await webhookService.processNotification(receiptNotification({ Url }));

        expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
        expect(Logger.prototype.warn).toHaveBeenCalled();
      },
    );

    it.each([
      '',
      'javascript:alert(1)',
      'https://user:password@ofd.example.com',
    ])('Должен отклонять недопустимую ссылку на чек %s', async (Url) => {
      await expect(
        webhookService.processNotification(receiptNotification({ Url })),
      ).rejects.toThrow(new BadRequestException('Invalid receipt URL'));
      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
    });

    it('Должен отклонять чек с невалидным токеном', async () => {
      tinkoffKassaServiceMock.checkToken.mockReturnValueOnce(false);

      await expect(
        webhookService.processNotification(receiptNotification()),
      ).rejects.toThrow(BadRequestException);
      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
    });

    it('Должен сохранять возврат без изменения исходной даты, подписки и пользователя', async () => {
      await webhookService.processNotification(
        paymentNotification({ Status: PAYMENT_NOTIFICATION_STATUSES.REFUNDED }),
      );

      expect(paymentRepositoryMock.update).toHaveBeenCalledWith('payment-id', {
        status: PaymentStatus.REFUNDED,
      });
      expect(subscriptionRepositoryMock.update).not.toHaveBeenCalled();
      expect(userRepositoryMock.update).not.toHaveBeenCalled();
    });

    it.each([
      RECEIPT_NOTIFICATION_STATUSES.RECEIPT,
      PAYMENT_NOTIFICATION_STATUSES.REFUNDED,
    ] as const)(
      'Должен возвращать ошибку для уведомления %s о неизвестном платеже',
      async (Status) => {
        paymentRepositoryMock.update.mockResolvedValueOnce({
          affected: 0,
          raw: [],
          generatedMaps: [],
        });

        await expect(
          webhookService.processNotification(
            Status === RECEIPT_NOTIFICATION_STATUSES.RECEIPT
              ? receiptNotification()
              : paymentNotification({ Status }),
          ),
        ).rejects.toThrow(new BadRequestException('Payment not found'));
      },
    );

    it('Не должен подтверждать возвращённый платёж и продлевать подписку', async () => {
      paymentRepositoryMock.findOne.mockResolvedValueOnce(
        Object.assign(new Payment(), {
          id: 'payment-id',
          status: PaymentStatus.REFUNDED,
        }),
      );

      await webhookService.processNotification(
        paymentNotification({
          Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
        }),
      );

      expect(paymentRepositoryMock.update).not.toHaveBeenCalled();
      expect(subscriptionRepositoryMock.update).not.toHaveBeenCalled();
      expect(userRepositoryMock.update).not.toHaveBeenCalled();
      expect(tariffServiceMock.getTariff).not.toHaveBeenCalled();
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
          pan: '430000******0777',
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

    it.each([new Date('2026-09-11T08:00:00.000Z'), null])(
      'Должен сохранять исходную дату подтверждённого платежа (%s) при повторном уведомлении',
      async (paymentDate) => {
        jest.useFakeTimers().setSystemTime(nextChargeAt);
        paymentRepositoryMock.findOne.mockResolvedValueOnce(
          Object.assign(new Payment(), {
            id: 'payment-id',
            user_id: 'user-id',
            subscription_id: 'subscription-id',
            status: PaymentStatus.CONFIRMED,
            payment_date: paymentDate,
            subscription: Object.assign(new Subscription(), {
              plan: SubscriptionPlan.PRO,
              six_months: false,
            }),
          }),
        );

        await webhookService.processNotification(
          paymentNotification({
            Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
          }),
        );

        expect(paymentRepositoryMock.update).toHaveBeenCalledWith(
          'payment-id',
          {
            status: PaymentStatus.CONFIRMED,
            payment_date: paymentDate,
          },
        );
      },
    );

    it.each([
      {
        Pan: '430000******1234',
        RebillId: 789,
        expectedPan: '430000******1234',
      },
      {
        Pan: '+7(900)***-**-12',
        RebillId: undefined,
        expectedPan: '+7(900)***-**-12',
      },
      {
        Pan: '  +7(900)***-**-12  ',
        RebillId: 0,
        expectedPan: '+7(900)***-**-12',
      },
    ])(
      'Должен сохранять Pan карты или телефона без потери маски ($Pan)',
      async ({ Pan, RebillId, expectedPan }) => {
        paymentRepositoryMock.findOne.mockResolvedValueOnce(
          Object.assign(new Payment(), {
            id: 'payment-id',
            user_id: 'user-id',
            subscription_id: 'subscription-id',
            status: PaymentStatus.NEW,
            subscription: Object.assign(new Subscription(), {
              plan: SubscriptionPlan.PRO,
              six_months: false,
            }),
          }),
        );

        await webhookService.processNotification(
          paymentNotification({
            Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
            Pan,
            RebillId,
          }),
        );

        expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
          'subscription-id',
          expect.objectContaining({ pan: expectedPan }),
        );
      },
    );

    it.each([undefined, '', '   '])(
      'Не должен затирать сохранённый Pan при подтверждении без маски (%s)',
      async (Pan) => {
        paymentRepositoryMock.findOne.mockResolvedValueOnce(
          Object.assign(new Payment(), {
            id: 'payment-id',
            user_id: 'user-id',
            subscription_id: 'subscription-id',
            status: PaymentStatus.NEW,
            subscription: Object.assign(new Subscription(), {
              plan: SubscriptionPlan.PRO,
              six_months: false,
              pan: '**** 1234',
            }),
          }),
        );

        await webhookService.processNotification(
          paymentNotification({
            Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
            RebillId: undefined,
            Pan,
          }),
        );

        expect(
          subscriptionRepositoryMock.update.mock.calls[0][1],
        ).not.toHaveProperty('pan');
      },
    );

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
