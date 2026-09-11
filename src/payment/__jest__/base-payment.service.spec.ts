import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { TariffService } from 'src/tariff/tariff.service';
import { type Tariff } from 'src/tariff/types';
import { type InsertResult, type Repository } from 'typeorm';
import { BasePaymentService } from '../base-payment.service';

const paymentRepositoryToken = getRepositoryToken(Payment) as string;

class TestPaymentService extends BasePaymentService {}

describe(BasePaymentService.name, () => {
  let paymentService: BasePaymentService;
  let paymentRepositoryMock: Mocked<Repository<Payment>>;
  let tariffServiceMock: Mocked<TariffService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(TestPaymentService)
      .mock(paymentRepositoryToken)
      .impl(() => ({ insert: jest.fn(), update: jest.fn() }))
      .mock(TariffService)
      .impl(() => ({ getTariff: jest.fn() }))
      .compile();

    paymentService = unit;
    paymentRepositoryMock = unitRef.get(paymentRepositoryToken);
    tariffServiceMock = unitRef.get(TariffService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createPayment', () => {
    it('Должен создать новый платёж со стоимостью рассчитанного тарифа', async () => {
      const tariff: Tariff = {
        id: SubscriptionPlan.PRO,
        price: 2_000,
        name: 'Про',
        description: 'Тариф Про',
        features: [],
      };
      tariffServiceMock.getTariff.mockResolvedValueOnce(tariff);
      const insertResult: InsertResult = {
        identifiers: [{ id: 'payment-id' }],
        generatedMaps: [],
        raw: [],
      };
      paymentRepositoryMock.insert.mockResolvedValueOnce(insertResult);

      await expect(
        paymentService.createPayment(
          'subscription-id',
          SubscriptionPlan.PRO,
          'user-id',
          true,
        ),
      ).resolves.toEqual({ paymentId: 'payment-id', amount: 2_000 });

      expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
        SubscriptionPlan.PRO,
        'user-id',
        true,
      );
      expect(paymentRepositoryMock.insert).toHaveBeenCalledWith({
        user_id: 'user-id',
        amount: 2_000,
        status: PaymentStatus.NEW,
        subscription_id: 'subscription-id',
      });
    });
  });

  describe('linkExternalPayment', () => {
    it('Должен сохранить внешний идентификатор платежа', async () => {
      await paymentService.linkExternalPayment('payment-id', 'external-id');

      expect(paymentRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'payment-id' },
        { external_payment_id: 'external-id' },
      );
    });
  });
});
