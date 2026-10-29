import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
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
        getSubscriptionIdForUser: jest.fn(),
        setPaymentMethodLinkRequest: jest.fn(),
        completePaymentMethodLink: jest.fn(),
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
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getPaymentMethodQr', () => {
    it('Должен создать QR без оплаты и привязать запрос к пользователю и подписке', async () => {
      subscriptionServiceMock.getSubscriptionIdForUser.mockResolvedValueOnce(
        'subscription-id',
      );
      tinkoffKassaServiceMock.addAccountQr.mockResolvedValueOnce({
        RequestKey: 'request-key',
        Data: '<svg />',
      } as Awaited<ReturnType<TinkoffKassaService['addAccountQr']>>);
      const createPayment = jest.spyOn(paymentService, 'createPayment');

      await expect(
        paymentService.getPaymentMethodQr(
          Object.assign(new User(), { id: 'user-id' }),
        ),
      ).resolves.toEqual({ svg: '<svg />' });

      expect(
        subscriptionServiceMock.getSubscriptionIdForUser,
      ).toHaveBeenCalledWith('user-id');
      expect(cacheManagerMock.set).toHaveBeenCalledWith(
        'request-key',
        {
          purpose: 'method_change',
          subscriptionId: 'subscription-id',
          userId: 'user-id',
        },
        30 * 60 * 1_000,
      );
      expect(
        subscriptionServiceMock.setPaymentMethodLinkRequest,
      ).toHaveBeenCalledWith('subscription-id', 'user-id', 'request-key');
      expect(createPayment).not.toHaveBeenCalled();
      expect(subscriptionServiceMock.createSubscription).not.toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.createPayment).not.toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.chargeQr).not.toHaveBeenCalled();
    });

    it('Должен вернуть конфликт до обращения в банк, если подписки нет', async () => {
      subscriptionServiceMock.getSubscriptionIdForUser.mockRejectedValueOnce(
        new ConflictException(),
      );

      await expect(
        paymentService.getPaymentMethodQr(
          Object.assign(new User(), { id: 'user-id' }),
        ),
      ).rejects.toThrow(ConflictException);
      expect(tinkoffKassaServiceMock.addAccountQr).not.toHaveBeenCalled();
      expect(cacheManagerMock.set).not.toHaveBeenCalled();
    });

    it('Не должен менять ожидаемый запрос при ошибке банка', async () => {
      subscriptionServiceMock.getSubscriptionIdForUser.mockResolvedValueOnce(
        'subscription-id',
      );
      tinkoffKassaServiceMock.addAccountQr.mockRejectedValueOnce(
        new Error('Bank unavailable'),
      );

      await expect(
        paymentService.getPaymentMethodQr(
          Object.assign(new User(), { id: 'user-id' }),
        ),
      ).rejects.toThrow('Bank unavailable');
      expect(cacheManagerMock.set).not.toHaveBeenCalled();
      expect(
        subscriptionServiceMock.setPaymentMethodLinkRequest,
      ).not.toHaveBeenCalled();
    });
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
    it('Должен завершать перепривязку без создания подписки, платежа или списания', async () => {
      cacheManagerMock.get.mockResolvedValueOnce({
        purpose: 'method_change',
        subscriptionId: 'subscription-id',
        userId: 'user-id',
      });
      subscriptionServiceMock.completePaymentMethodLink.mockResolvedValueOnce(
        true,
      );
      const createPayment = jest.spyOn(paymentService, 'createPayment');

      await paymentService.onAccountLinked(accountLinkedNotification);

      expect(
        subscriptionServiceMock.completePaymentMethodLink,
      ).toHaveBeenCalledWith(
        'subscription-id',
        'user-id',
        'request-key',
        'account-token',
      );
      expect(createPayment).not.toHaveBeenCalled();
      expect(subscriptionServiceMock.createSubscription).not.toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.createPayment).not.toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.chargeQr).not.toHaveBeenCalled();
    });

    it('Должен явно отклонять неизвестный или истёкший запрос без списания', async () => {
      cacheManagerMock.get.mockResolvedValueOnce(undefined);

      await expect(
        paymentService.onAccountLinked(accountLinkedNotification),
      ).rejects.toThrow(BadRequestException);
      expect(subscriptionServiceMock.createSubscription).not.toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.chargeQr).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
    });

    it('Не должен повторять завершённую или устаревшую перепривязку', async () => {
      cacheManagerMock.get.mockResolvedValueOnce({
        purpose: 'method_change',
        subscriptionId: 'subscription-id',
        userId: 'user-id',
      });
      subscriptionServiceMock.completePaymentMethodLink.mockResolvedValueOnce(
        false,
      );

      await paymentService.onAccountLinked(accountLinkedNotification);

      expect(Logger.prototype.warn).toHaveBeenCalled();
      expect(tinkoffKassaServiceMock.chargeQr).not.toHaveBeenCalled();
    });

    it.each(['', '   '])(
      'Не должен сохранять пустой токен счёта (%s)',
      async (AccountToken) => {
        cacheManagerMock.get.mockResolvedValueOnce({
          purpose: 'method_change',
          subscriptionId: 'subscription-id',
          userId: 'user-id',
        });

        await expect(
          paymentService.onAccountLinked({
            ...accountLinkedNotification,
            AccountToken,
          }),
        ).rejects.toThrow(BadRequestException);
        expect(
          subscriptionServiceMock.completePaymentMethodLink,
        ).not.toHaveBeenCalled();
      },
    );

    it.each(['Банк', undefined])(
      'Должен создать платёж и сохранить токен счёта независимо от названия банка (%s)',
      async (bankMemberName) => {
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
        jest
          .spyOn(paymentService, 'linkExternalPayment')
          .mockResolvedValueOnce();
        tinkoffKassaServiceMock.createPayment.mockResolvedValueOnce({
          PaymentId: 'external-payment-id',
        } as Awaited<ReturnType<TinkoffKassaService['createPayment']>>);

        await paymentService.onAccountLinked({
          ...accountLinkedNotification,
          BankMemberName: bankMemberName,
        });

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
      },
    );
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
