import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { PaymentAmountService } from 'src/payment/payment-amount.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';

jest.setTimeout(120_000);

describe('T-Pay (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let paymentService: TpayPaymentService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;

  const promotionServiceMock = {
    getFirstSubscriptionPromotion: jest.fn(),
    getSixMonthsSubscriptionPromotion: jest.fn(),
  };
  const tinkoffKassaServiceMock = {
    charge: jest.fn(),
    checkTPayLink: jest.fn(),
    createPayment: jest.fn(),
    getTPayLink: jest.fn(),
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [User, Subscription, Payment],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User, Subscription, Payment]),
      ],
      providers: [
        TpayPaymentService,
        PaymentAmountService,
        SubscriptionService,
        TariffService,
        { provide: PromotionService, useValue: promotionServiceMock },
        {
          provide: TinkoffKassaService,
          useValue: tinkoffKassaServiceMock,
        },
      ],
    }).compile();

    paymentService = moduleRef.get(TpayPaymentService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValue(
      undefined,
    );
    promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValue(
      undefined,
    );
    tinkoffKassaServiceMock.checkTPayLink.mockResolvedValue({
      Params: { Version: '2.1' },
    });
    tinkoffKassaServiceMock.createPayment.mockResolvedValue({
      PaymentId: 'external-payment-id',
    });
    tinkoffKassaServiceMock.getTPayLink.mockResolvedValue({
      Params: { RedirectUrl: 'https://pay.example.com', WebQR: 'qr-data' },
    });
  });

  afterEach(async () => {
    if (!paymentRepository || !subscriptionRepository || !userRepository) {
      return;
    }

    await paymentRepository.createQueryBuilder().delete().execute();
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }

    if (container) {
      await container.stop();
    }

    jest.restoreAllMocks();
  });

  it('Должен создать подписку и платёж, привязать внешний ID и вернуть ссылку T-Pay', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });
    const request = {
      clientInfo: {
        device: { type: 'mobile' },
        os: { name: 'Android' },
      },
    } as Request;

    await expect(
      paymentService.getTPayLink(
        { tariff: SubscriptionPlan.PLUS, sixMonths: true },
        user,
        request,
      ),
    ).resolves.toEqual({
      RedirectUrl: 'https://pay.example.com',
      WebQR: 'qr-data',
    });

    const subscription = await subscriptionRepository.findOneByOrFail({
      user_id: user.id,
    });
    const payment = await paymentRepository.findOneByOrFail({
      subscription_id: subscription.id,
    });

    expect(subscription).toMatchObject({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.PENDING,
    });
    expect(payment).toMatchObject({
      user_id: user.id,
      subscription_id: subscription.id,
      amount: 6_000,
      external_payment_id: 'external-payment-id',
      status: PaymentStatus.NEW,
    });
    expect(tinkoffKassaServiceMock.createPayment).toHaveBeenCalledWith({
      OrderId: payment.id,
      Amount: 6_000,
      CustomerKey: user.id,
      Email: user.email,
      DATA: {
        TinkoffPayWeb: true,
        Device: 'Mobile',
        DeviceOs: 'Android',
        DeviceWebView: true,
        OperationInitiatorType: 'R',
      },
    });
    expect(tinkoffKassaServiceMock.getTPayLink).toHaveBeenCalledWith(
      'external-payment-id',
      '2.1',
    );
  });
});
