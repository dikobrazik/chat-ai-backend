import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TestBed, type Mocked } from '@suites/unit';
import { type Cache } from 'cache-manager';
import { Subscription, SubscriptionPlan } from 'src/entities/Subscription';
import { User } from 'src/entities/User';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TinkoffKassaService } from '../../tinkoff-kassa/tinkoff-kassa.service';
import { type AddAccountQrNotification } from '../../webhook/types';
import { PaymentMethod } from '../../payment-amount.service';
import { SbpPaymentService } from '../sbp-payment.service';

const accountLinkedNotification: AddAccountQrNotification = {
  TerminalKey: 'terminal-key',
  RequestKey: 'request-key',
  Status: 'ACTIVE',
  Success: true,
  ErrorCode: '0',
  Message: 'OK',
  AccountToken: 'account-token',
  BankMemberId: 'member-id',
  BankMemberName: 'Банк',
  Token: 'token',
  NotificationType: 'LinkAccount',
};

describe(SbpPaymentService.name, () => {
  let paymentService: SbpPaymentService;
  let cacheManagerMock: Mocked<Cache>;
  let subscriptionServiceMock: Mocked<SubscriptionService>;
  let tinkoffKassaServiceMock: Mocked<TinkoffKassaService>;
  const createSubscriptionMock = jest.fn<
    ReturnType<SubscriptionService['createSubscription']>,
    Parameters<SubscriptionService['createSubscription']>
  >();

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SbpPaymentService)
      .mock(CACHE_MANAGER)
      .impl(() => ({ get: jest.fn(), set: jest.fn() }))
      .mock(SubscriptionService)
      .impl(() => ({
        createSubscription: createSubscriptionMock,
        updateAccountToken: jest.fn(),
      }))
      .mock(TinkoffKassaService)
      .impl(() => ({
        addAccountQr: jest.fn(),
        chargeQr: jest.fn(),
        createPayment: jest.fn(),
      }))
      .compile();

    paymentService = unit;
    cacheManagerMock = unitRef.get(CACHE_MANAGER);
    subscriptionServiceMock = unitRef.get(SubscriptionService);
    tinkoffKassaServiceMock = unitRef.get(TinkoffKassaService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getAddAccountQr', () => {
    it('Должен вернуть SVG QR-кода и сохранить параметры запроса на 30 минут', async () => {
      tinkoffKassaServiceMock.addAccountQr.mockResolvedValueOnce({
        RequestKey: 'request-key',
        Data: '<svg />',
      } as Awaited<ReturnType<TinkoffKassaService['addAccountQr']>>);

      await expect(
        paymentService.getAddAccountQr(
          { tariff: SubscriptionPlan.PLUS, sixMonths: true },
          { id: 'user-id', email: 'user@example.com' } as User,
        ),
      ).resolves.toEqual({ svg: '<svg />' });

      expect(cacheManagerMock.set).toHaveBeenCalledWith(
        'request-key',
        {
          tariffId: SubscriptionPlan.PLUS,
          sixMonths: true,
          userId: 'user-id',
          userEmail: 'user@example.com',
        },
        30 * 60 * 1_000,
      );
    });
  });

  describe('onAccountLinked', () => {
    it('Должен создать, связать и списать платёж для привязанного счёта', async () => {
      cacheManagerMock.get.mockResolvedValueOnce({
        tariffId: SubscriptionPlan.PRO,
        sixMonths: false,
        userId: 'user-id',
        userEmail: 'user@example.com',
      });
      createSubscriptionMock.mockResolvedValueOnce({
        subscriptionId: 'subscription-id',
      });
      jest
        .spyOn(paymentService, 'createPayment')
        .mockResolvedValueOnce({ paymentId: 'payment-id', amount: 2_000 });
      jest.spyOn(paymentService, 'linkExternalPayment').mockResolvedValueOnce();
      tinkoffKassaServiceMock.createPayment.mockResolvedValueOnce({
        PaymentId: 'external-payment-id',
      } as Awaited<ReturnType<TinkoffKassaService['createPayment']>>);

      await paymentService.onAccountLinked(accountLinkedNotification);

      expect(subscriptionServiceMock.createSubscription).toHaveBeenCalledWith(
        SubscriptionPlan.PRO,
        'user-id',
        false,
      );
      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'subscription-id',
        SubscriptionPlan.PRO,
        'user-id',
        false,
        PaymentMethod.SBP,
      );
      expect(tinkoffKassaServiceMock.createPayment).toHaveBeenCalledWith({
        OrderId: 'payment-id',
        Amount: 2_000,
        CustomerKey: 'user-id',
        Email: 'user@example.com',
        DATA: { QR: 'true', OperationInitiatorType: 'R' },
      });
      expect(paymentService.linkExternalPayment).toHaveBeenCalledWith(
        'payment-id',
        'external-payment-id',
      );
      expect(subscriptionServiceMock.updateAccountToken).toHaveBeenCalledWith(
        'subscription-id',
        'account-token',
      );
      expect(tinkoffKassaServiceMock.chargeQr).toHaveBeenCalledWith(
        'external-payment-id',
        'account-token',
      );
    });
  });

  describe('charge', () => {
    it('Должен создать и списать повторный платёж через СБП', async () => {
      jest
        .spyOn(paymentService, 'createPayment')
        .mockResolvedValueOnce({ paymentId: 'payment-id', amount: 1_000 });
      tinkoffKassaServiceMock.createPayment.mockResolvedValueOnce({
        PaymentId: 'external-payment-id',
      } as Awaited<ReturnType<TinkoffKassaService['createPayment']>>);

      await paymentService.charge(
        {
          id: 'subscription-id',
          plan: SubscriptionPlan.PLUS,
          user_id: 'user-id',
          account_token: 'account-token',
          user: { email: 'user@example.com' },
        } as Subscription,
        false,
      );

      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'subscription-id',
        SubscriptionPlan.PLUS,
        'user-id',
        false,
        PaymentMethod.SBP,
      );
      expect(tinkoffKassaServiceMock.chargeQr).toHaveBeenCalledWith(
        'external-payment-id',
        'account-token',
      );
    });
  });
});
