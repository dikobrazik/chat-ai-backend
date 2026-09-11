import 'reflect-metadata';

import { CacheModule } from '@nestjs/cache-manager';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { LINK_ACCOUNT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';
import { AddAccountQrNotification } from 'src/payment/webhook/types';
import { WebhookService } from 'src/payment/webhook/webhook.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';

jest.setTimeout(120_000);

const accountLinkNotification = (
  overrides: Partial<AddAccountQrNotification> = {},
): AddAccountQrNotification => ({
  TerminalKey: 'terminal-key',
  RequestKey: 'request-key',
  Status: LINK_ACCOUNT_NOTIFICATION_STATUSES.ACTIVE,
  Success: true,
  ErrorCode: '0',
  Message: 'OK',
  AccountToken: 'account-token',
  BankMemberId: 'member-id',
  BankMemberName: 'Банк',
  Token: 'valid-token',
  NotificationType: 'LinkAccount',
  ...overrides,
});

describe('СБП-привязка счёта (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let webhookService: WebhookService;
  let sbpPaymentService: SbpPaymentService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;

  const promotionServiceMock = {
    getFirstSubscriptionPromotion: jest.fn(),
    getSixMonthsSubscriptionPromotion: jest.fn(),
  };
  const tinkoffKassaServiceMock = {
    addAccountQr: jest.fn(),
    chargeQr: jest.fn(),
    checkToken: jest.fn(),
    createPayment: jest.fn(),
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
        CacheModule.register(),
      ],
      providers: [
        WebhookService,
        SbpPaymentService,
        SubscriptionService,
        TariffService,
        { provide: PromotionService, useValue: promotionServiceMock },
        {
          provide: TinkoffKassaService,
          useValue: tinkoffKassaServiceMock,
        },
      ],
    }).compile();

    webhookService = moduleRef.get(WebhookService);
    sbpPaymentService = moduleRef.get(SbpPaymentService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    tinkoffKassaServiceMock.checkToken.mockReturnValue(true);
    tinkoffKassaServiceMock.createPayment.mockResolvedValue({
      PaymentId: 'external-payment-id',
    });
    tinkoffKassaServiceMock.addAccountQr.mockResolvedValue({
      RequestKey: 'request-key',
      Data: '<svg />',
    });
    promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValue(
      undefined,
    );
    promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValue(
      undefined,
    );
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

  it('Должен создать подписку и платёж, сохранить токен счёта и списать деньги после ACTIVE-уведомления', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });
    await expect(
      sbpPaymentService.getAddAccountQr(
        { tariff: SubscriptionPlan.PRO, sixMonths: false },
        user,
      ),
    ).resolves.toEqual({ svg: '<svg />' });

    await webhookService.processNotification(accountLinkNotification());

    const subscription = await subscriptionRepository.findOneByOrFail({
      user_id: user.id,
    });
    const payment = await paymentRepository.findOneByOrFail({
      subscription_id: subscription.id,
    });

    expect(subscription).toMatchObject({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PENDING,
      account_token: 'account-token',
    });
    expect(payment).toMatchObject({
      user_id: user.id,
      subscription_id: subscription.id,
      amount: 2_000,
      external_payment_id: 'external-payment-id',
      status: PaymentStatus.NEW,
    });
    expect(tinkoffKassaServiceMock.chargeQr).toHaveBeenCalledWith(
      'external-payment-id',
      'account-token',
    );
  });

  it('Не должен создавать подписку, платёж или списание при неуспешной привязке счёта', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });

    await sbpPaymentService.getAddAccountQr(
      { tariff: SubscriptionPlan.PRO, sixMonths: false },
      user,
    );

    await expect(
      webhookService.processNotification(
        accountLinkNotification({
          Status: LINK_ACCOUNT_NOTIFICATION_STATUSES.INACTIVE,
          Success: false,
        }),
      ),
    ).resolves.toBeUndefined();

    await expect(subscriptionRepository.count()).resolves.toBe(0);
    await expect(paymentRepository.count()).resolves.toBe(0);
    expect(tinkoffKassaServiceMock.chargeQr).not.toHaveBeenCalled();
  });
});
