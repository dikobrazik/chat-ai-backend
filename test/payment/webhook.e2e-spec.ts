import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { TariffService } from 'src/tariff/tariff.service';
import { PAYMENT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';
import { WebhookService } from 'src/payment/webhook/webhook.service';
import { WebhookController } from 'src/payment/webhook/webhook.controller';
import {
  createPayment,
  createPaymentNotification,
  createReceiptNotification,
  createSubscription,
} from './fixtures';

jest.setTimeout(120_000);

describe('Уведомления об оплате (интеграционный тест)', () => {
  const now = new Date('2026-09-11T08:00:00.000Z');
  const nextChargeAt = new Date('2026-10-11T08:00:00.000Z');
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let currentUser: User;
  let webhookService: WebhookService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;
  const kassaServiceMock = { checkToken: jest.fn() };
  const tariffServiceMock = { getTariff: jest.fn() };

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
      controllers: [WebhookController],
      providers: [
        WebhookService,
        {
          provide: SbpPaymentService,
          useValue: { onAccountLinked: jest.fn() },
        },
        {
          provide: TinkoffKassaService,
          useValue: kassaServiceMock,
        },
        {
          provide: PromotionService,
          useValue: { markPromotionAsUsed: jest.fn() },
        },
        {
          provide: TariffService,
          useValue: tariffServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    webhookService = moduleRef.get(WebhookService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    kassaServiceMock.checkToken.mockReturnValue(true);
    tariffServiceMock.getTariff.mockResolvedValue({ nextChargeAt });
    jest.spyOn(console, 'log').mockImplementation();
    jest.useFakeTimers({
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
    jest.setSystemTime(now);
    currentUser = await userRepository.save({
      email: 'webhook@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (!paymentRepository || !subscriptionRepository || !userRepository) {
      return;
    }

    await paymentRepository.createQueryBuilder().delete().execute();
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    } else if (moduleRef) {
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
    const subscription = await createSubscription(subscriptionRepository, user);
    const payment = await paymentRepository.save({
      user_id: user.id,
      subscription_id: subscription.id,
      amount: 2_000,
      status: PaymentStatus.NEW,
    });

    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id }),
    );

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
      tpay_card_mask: '**** 0777',
    });
    expect(String(updatedSubscription.rebill_id)).toBe('789');
    expect(updatedSubscription.current_period_end).toEqual(nextChargeAt);
    expect(updatedUser).toMatchObject({
      id: user.id,
      status: UserStatus.SUBSCRIPTION_PRO,
    });
  });

  it('Должен сохранять чек до подтверждения оплаты', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
    );
    const receipt = createReceiptNotification({
      OrderId: payment.id,
      Token: 'valid-token',
    });
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(receipt)
      .expect(200)
      .expect('OK');

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.NEW,
      payment_date: null,
      receipt_url: receipt.Url,
    });

    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createPaymentNotification({ OrderId: payment.id }))
      .expect(200)
      .expect('OK');

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.CONFIRMED,
      payment_date: now,
      receipt_url: receipt.Url,
    });
  });

  it('Должен записывать дату отклонения и сохранять её при повторном уведомлении', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
    );
    const notification = createPaymentNotification({
      OrderId: payment.id,
      Success: false,
      Status: PAYMENT_NOTIFICATION_STATUSES.REJECTED,
    });
    await webhookService.processNotification(notification);
    jest.setSystemTime(nextChargeAt);
    await webhookService.processNotification(notification);

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.REJECTED,
      payment_date: now,
      receipt_url: null,
    });
  });

  it('Не должен отклонять успешный платёж при ошибке фискализации или позднем отказе', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
      {
        status: PaymentStatus.CONFIRMED,
        payment_date: now,
        receipt_url: 'https://ofd.example.com/receipt/old',
      },
    );
    await webhookService.processNotification(
      createReceiptNotification({
        OrderId: payment.id,
        Token: 'valid-token',
        Success: false,
        ErrorCode: '123',
      }),
    );
    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id, Success: false }),
    );

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.CONFIRMED,
      payment_date: now,
      receipt_url: payment.receipt_url,
    });
  });

  it('Должен сохранять исходную дату при повторном подтверждении', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
    );
    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id }),
    );
    jest.setSystemTime(nextChargeAt);
    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id }),
    );

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.CONFIRMED,
      payment_date: now,
    });
  });

  it('Должен сохранять возврат с исходной датой и не подтверждать возвращённый платёж повторно', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
      {
        status: PaymentStatus.CONFIRMED,
        payment_date: now,
      },
    );
    jest.setSystemTime(nextChargeAt);
    await webhookService.processNotification(
      createPaymentNotification({
        OrderId: payment.id,
        Status: PAYMENT_NOTIFICATION_STATUSES.REFUNDED,
      }),
    );
    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id }),
    );
    await webhookService.processNotification(
      createPaymentNotification({ OrderId: payment.id, Success: false }),
    );

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({
      status: PaymentStatus.REFUNDED,
      payment_date: now,
      receipt_url: null,
    });
    expect(
      await subscriptionRepository.findOneByOrFail({
        id: payment.subscription_id,
      }),
    ).toMatchObject({ status: SubscriptionStatus.PENDING });
  });

  it('Не должен сохранять чек с невалидным токеном', async () => {
    const payment = await createPayment(
      paymentRepository,
      subscriptionRepository,
      currentUser,
    );
    kassaServiceMock.checkToken.mockReturnValueOnce(false);

    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(
        createReceiptNotification({
          OrderId: payment.id,
          Token: 'valid-token',
        }),
      )
      .expect(400);

    expect(
      await paymentRepository.findOneByOrFail({ id: payment.id }),
    ).toMatchObject({ status: PaymentStatus.NEW, receipt_url: null });
  });
});
