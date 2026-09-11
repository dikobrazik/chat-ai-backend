import 'reflect-metadata';

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
import { PAYMENT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';
import { WebhookService } from 'src/payment/webhook/webhook.service';

jest.setTimeout(120_000);

describe('WebhookService (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let webhookService: WebhookService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;

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
        WebhookService,
        {
          provide: SbpPaymentService,
          useValue: { onAccountLinked: jest.fn() },
        },
        {
          provide: TinkoffKassaService,
          useValue: { checkToken: jest.fn(() => true) },
        },
      ],
    }).compile();

    webhookService = moduleRef.get(WebhookService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
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

  it('Должен сохранить подтверждение платежа, активировать подписку и обновить статус пользователя', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });
    const subscription = await subscriptionRepository.save({
      user_id: user.id,
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PENDING,
      current_period_start: new Date('2026-09-11T08:00:00.000Z'),
      current_period_end: new Date('2026-10-11T08:00:00.000Z'),
    });
    const payment = await paymentRepository.save({
      user_id: user.id,
      subscription_id: subscription.id,
      amount: 2_000,
      status: PaymentStatus.NEW,
    });

    await webhookService.processNotification({
      TerminalKey: 'terminal-key',
      OrderId: payment.id,
      Success: true,
      Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
      PaymentId: 123,
      ErrorCode: '0',
      Amount: 2_000,
      CardId: 456,
      Pan: '430000******0777',
      ExpDate: '1228',
      RebillId: 789,
      Token: 'valid-token',
    });

    const [updatedPayment, updatedSubscription, updatedUser] =
      await Promise.all([
        paymentRepository.findOneByOrFail({ id: payment.id }),
        subscriptionRepository.findOneByOrFail({ id: subscription.id }),
        userRepository.findOneByOrFail({ id: user.id }),
      ]);

    expect(updatedPayment).toMatchObject({
      id: payment.id,
      status: PaymentStatus.CONFIRMED,
    });
    expect(updatedPayment.payment_date).toBeInstanceOf(Date);
    expect(updatedSubscription).toMatchObject({
      id: subscription.id,
      user_id: user.id,
      status: SubscriptionStatus.ACTIVE,
    });
    expect(String(updatedSubscription.rebill_id)).toBe('789');
    expect(updatedUser).toMatchObject({
      id: user.id,
      status: UserStatus.SUBSCRIPTION_PRO,
    });
  });
});
