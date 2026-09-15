import 'reflect-metadata';

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Request } from 'express';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Promotion,
  PromotionRewardType,
  PromotionType,
} from 'src/entities/Promotion';
import { Subscription, SubscriptionPlan } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { UserPromotion, UserPromotionStatus } from 'src/entities/UserPromotion';
import { PaymentAmountService } from 'src/payment/payment-amount.service';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { PAYMENT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';
import { WebhookService } from 'src/payment/webhook/webhook.service';
import {
  FIRST_SUBSCRIPTION_PROMOTION_ID,
  SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
} from 'src/promotion/constants';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionCheckService } from 'src/subscription/cron/subscription-check.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';

jest.setTimeout(120_000);

describe('Использование акции при оплате (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let tpayPaymentService: TpayPaymentService;
  let webhookService: WebhookService;
  let subscriptionCheckService: SubscriptionCheckService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;
  let promotionRepository: Repository<Promotion>;
  let userPromotionRepository: Repository<UserPromotion>;

  const tinkoffKassaServiceMock = {
    charge: jest.fn(),
    checkTPayLink: jest.fn(),
    checkToken: jest.fn(),
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
          entities: [User, Subscription, Payment, Promotion, UserPromotion],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          User,
          Subscription,
          Payment,
          Promotion,
          UserPromotion,
        ]),
      ],
      providers: [
        PaymentAmountService,
        PromotionService,
        SubscriptionService,
        TariffService,
        TpayPaymentService,
        WebhookService,
        SubscriptionCheckService,
        {
          provide: SbpPaymentService,
          useValue: { charge: jest.fn() },
        },
        {
          provide: TinkoffKassaService,
          useValue: tinkoffKassaServiceMock,
        },
        {
          provide: UserService,
          useValue: { resetSubscription: jest.fn() },
        },
      ],
    }).compile();

    tpayPaymentService = moduleRef.get(TpayPaymentService);
    webhookService = moduleRef.get(WebhookService);
    subscriptionCheckService = moduleRef.get(SubscriptionCheckService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
    promotionRepository = moduleRef.get(getRepositoryToken(Promotion));
    userPromotionRepository = moduleRef.get(getRepositoryToken(UserPromotion));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    tinkoffKassaServiceMock.checkToken.mockReturnValue(true);
    tinkoffKassaServiceMock.checkTPayLink.mockResolvedValue({
      Params: { Version: '2.1' },
    });
    tinkoffKassaServiceMock.createPayment.mockResolvedValue({
      PaymentId: 'external-payment-id',
    });
    tinkoffKassaServiceMock.getTPayLink.mockResolvedValue({
      Params: { RedirectUrl: 'https://pay.example.com' },
    });

    await promotionRepository.save([
      {
        id: FIRST_SUBSCRIPTION_PROMOTION_ID,
        name: 'Первая подписка',
        type: PromotionType.NEW_USER,
        reward_type: PromotionRewardType.FREE_DAYS,
        reward_value: 14,
      },
      {
        id: SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
        name: 'Подписка на шесть месяцев',
        type: PromotionType.MANUAL,
        reward_type: PromotionRewardType.PERCENT_DISCOUNT,
        reward_value: 10,
      },
    ]);
  });

  afterEach(async () => {
    await userPromotionRepository.createQueryBuilder().delete().execute();
    await paymentRepository.createQueryBuilder().delete().execute();
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
    await promotionRepository.createQueryBuilder().delete().execute();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
    jest.restoreAllMocks();
  });

  it('Должен списать пробную сумму один раз и списывать полную сумму при следующем запуске cron', async () => {
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

    await tpayPaymentService.getTPayLink(
      { tariff: SubscriptionPlan.PLUS, sixMonths: false },
      user,
      request,
    );

    const subscription = await subscriptionRepository.findOneByOrFail({
      user_id: user.id,
    });
    const firstPayment = await paymentRepository.findOneByOrFail({
      subscription_id: subscription.id,
    });

    expect(firstPayment.amount).toBe(100);

    await webhookService.processNotification({
      TerminalKey: 'terminal-key',
      OrderId: firstPayment.id,
      Success: true,
      Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
      PaymentId: 123,
      ErrorCode: '0',
      Amount: 100,
      CardId: 456,
      Pan: '430000******0777',
      ExpDate: '1228',
      RebillId: 789,
      Token: 'valid-token',
    });

    await expect(
      userPromotionRepository.findOneOrFail({
        where: {
          user_id: user.id,
          promotion_id: FIRST_SUBSCRIPTION_PROMOTION_ID,
        },
      }),
    ).resolves.toMatchObject({
      status: UserPromotionStatus.CONSUMED,
      payment_id: firstPayment.id,
    });

    await subscriptionRepository.update(subscription.id, {
      current_period_end: new Date('2026-01-01T00:00:00.000Z'),
    });

    await subscriptionCheckService.handleSubscriptionCheck();

    const recurringPayment = await paymentRepository.findOneOrFail({
      where: {
        subscription_id: subscription.id,
        status: PaymentStatus.NEW,
      },
      order: { payment_date: 'DESC' },
    });
    const payments = await paymentRepository.find({
      where: { subscription_id: subscription.id },
      order: { payment_date: 'ASC' },
    });

    expect(payments).toHaveLength(2);
    expect(recurringPayment.amount).toBe(1_000);
    expect(tinkoffKassaServiceMock.charge).toHaveBeenCalledWith(
      'external-payment-id',
      '789',
      user.email,
    );
  });
});
