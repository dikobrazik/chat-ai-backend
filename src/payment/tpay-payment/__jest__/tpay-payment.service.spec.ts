import { TestBed, type Mocked } from '@suites/unit';
import { type Request } from 'express';
import { Subscription, SubscriptionPlan } from 'src/entities/Subscription';
import { User } from 'src/entities/User';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TinkoffKassaService } from '../../tinkoff-kassa/tinkoff-kassa.service';
import { TpayPaymentService } from '../tpay-payment.service';

const requestWithDevice = (type: string, os: string) =>
  ({
    clientInfo: { device: { type }, os: { name: os } },
  }) as Request;

describe(TpayPaymentService.name, () => {
  let paymentService: TpayPaymentService;
  let subscriptionServiceMock: Mocked<SubscriptionService>;
  let tinkoffKassaServiceMock: Mocked<TinkoffKassaService>;
  const createSubscriptionMock = jest.fn<
    ReturnType<SubscriptionService['createSubscription']>,
    Parameters<SubscriptionService['createSubscription']>
  >();

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(TpayPaymentService)
      .mock(SubscriptionService)
      .impl(() => ({ createSubscription: createSubscriptionMock }))
      .mock(TinkoffKassaService)
      .impl(() => ({
        charge: jest.fn(),
        checkTPayLink: jest.fn(),
        createPayment: jest.fn(),
        getTPayLink: jest.fn(),
      }))
      .compile();

    paymentService = unit;
    subscriptionServiceMock = unitRef.get(SubscriptionService);
    tinkoffKassaServiceMock = unitRef.get(TinkoffKassaService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getTPayLink', () => {
    it('Должен создать платёж и вернуть параметры ссылки T-Pay для мобильного устройства', async () => {
      createSubscriptionMock.mockResolvedValueOnce({
        subscriptionId: 'subscription-id',
      });
      jest
        .spyOn(paymentService, 'createPayment')
        .mockResolvedValueOnce({ paymentId: 'payment-id', amount: 1_000 });
      jest.spyOn(paymentService, 'linkExternalPayment').mockResolvedValueOnce();
      tinkoffKassaServiceMock.checkTPayLink.mockResolvedValueOnce({
        Params: { Version: '2.1' },
      } as Awaited<ReturnType<TinkoffKassaService['checkTPayLink']>>);
      tinkoffKassaServiceMock.createPayment.mockResolvedValueOnce({
        PaymentId: 'external-payment-id',
      } as Awaited<ReturnType<TinkoffKassaService['createPayment']>>);
      tinkoffKassaServiceMock.getTPayLink.mockResolvedValueOnce({
        Params: { RedirectUrl: 'https://pay.example.com', WebQR: 'qr-data' },
      } as Awaited<ReturnType<TinkoffKassaService['getTPayLink']>>);

      await expect(
        paymentService.getTPayLink(
          { tariff: SubscriptionPlan.PLUS, sixMonths: true },
          { id: 'user-id', email: 'user@example.com' } as User,
          requestWithDevice('mobile', 'Android'),
        ),
      ).resolves.toEqual({
        RedirectUrl: 'https://pay.example.com',
        WebQR: 'qr-data',
      });

      expect(tinkoffKassaServiceMock.createPayment).toHaveBeenCalledWith({
        OrderId: 'payment-id',
        Amount: 1_000,
        CustomerKey: 'user-id',
        Email: 'user@example.com',
        DATA: {
          TinkoffPayWeb: true,
          Device: 'Mobile',
          DeviceOs: 'Android',
          DeviceWebView: true,
          OperationInitiatorType: 'R',
        },
      });
      expect(paymentService.linkExternalPayment).toHaveBeenCalledWith(
        'payment-id',
        'external-payment-id',
      );
      expect(tinkoffKassaServiceMock.getTPayLink).toHaveBeenCalledWith(
        'external-payment-id',
        '2.1',
      );
    });

    it('Должен отклонить запрос с неподдерживаемой операционной системой до создания подписки', async () => {
      await expect(
        paymentService.getTPayLink(
          { tariff: SubscriptionPlan.PLUS, sixMonths: false },
          { id: 'user-id', email: 'user@example.com' } as User,
          requestWithDevice('desktop', 'FreeBSD'),
        ),
      ).rejects.toThrow('Unsupported OS: FreeBSD');

      expect(subscriptionServiceMock.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe('charge', () => {
    it('Должен создать и списать повторный платёж по RebillId', async () => {
      jest
        .spyOn(paymentService, 'createPayment')
        .mockResolvedValueOnce({ paymentId: 'payment-id', amount: 2_000 });
      tinkoffKassaServiceMock.createPayment.mockResolvedValueOnce({
        PaymentId: 'external-payment-id',
      } as Awaited<ReturnType<TinkoffKassaService['createPayment']>>);

      await paymentService.charge(
        {
          id: 'subscription-id',
          plan: SubscriptionPlan.PRO,
          user_id: 'user-id',
          rebill_id: 123,
          user: { email: 'user@example.com' },
        } as Subscription,
        true,
      );

      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'subscription-id',
        SubscriptionPlan.PRO,
        'user-id',
        true,
      );
      expect(tinkoffKassaServiceMock.charge).toHaveBeenCalledWith(
        'external-payment-id',
        123,
        'user@example.com',
      );
    });
  });
});
