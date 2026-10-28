import 'reflect-metadata';

import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { INestApplication, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { type Cache } from 'cache-manager';
import { type Request } from 'express';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { PaymentAmountService } from 'src/payment/payment-amount.service';
import { PaymentController } from 'src/payment/payment.controller';
import { PaymentService } from 'src/payment/payment.service';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { TbankPaymentService } from 'src/payment/tbank-payment/tbank-payment.service';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { LINK_ACCOUNT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';
import { WebhookController } from 'src/payment/webhook/webhook.controller';
import { WebhookService } from 'src/payment/webhook/webhook.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';
import { createAccountLinkNotification, createSubscription } from './fixtures';

jest.setTimeout(120_000);

describe('POST /api/payment/method/generate-qr (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let currentUser: User;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let paymentRepository: Repository<Payment>;
  let cache: Cache;
  const kassa = {
    addAccountQr: jest.fn(),
    checkToken: jest.fn(),
    createPayment: jest.fn(),
    chargeQr: jest.fn(),
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
      controllers: [PaymentController, WebhookController],
      providers: [
        SbpPaymentService,
        SubscriptionService,
        PaymentService,
        { provide: TbankPaymentService, useValue: {} },
        PaymentAmountService,
        WebhookService,
        { provide: TpayPaymentService, useValue: { getTPayLink: jest.fn() } },
        { provide: TinkoffKassaService, useValue: kassa },
        { provide: TariffService, useValue: { getTariff: jest.fn() } },
        {
          provide: PromotionService,
          useValue: { markPromotionAsUsed: jest.fn() },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res, next) => {
      req.user = currentUser;
      next();
    });
    await app.init();
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    paymentRepository = moduleRef.get(getRepositoryToken(Payment));
    cache = moduleRef.get(CACHE_MANAGER);
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    await cache.clear();
    kassa.addAccountQr.mockResolvedValue({
      RequestKey: 'request-key',
      Data: '<svg />',
    });
    kassa.checkToken.mockReturnValue(true);
    currentUser = await userRepository.save({
      email: 'qr@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    if (paymentRepository && subscriptionRepository && userRepository) {
      await paymentRepository.createQueryBuilder().delete().execute();
      await subscriptionRepository.createQueryBuilder().delete().execute();
      await userRepository.createQueryBuilder().delete().execute();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    } else if (moduleRef) {
      await moduleRef.close();
    }
    await container?.stop();
  });

  it('Должен возвращать QR без списания и без изменения подписки до привязки', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      {
        status: SubscriptionStatus.ACTIVE,
        rebill_id: 123,
        tpay_card_mask: '**** 0777',
      },
    );
    const before = await subscriptionRepository.findOneByOrFail({
      id: subscription.id,
    });

    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201)
      .expect({ svg: '<svg />' });

    expect(
      await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).toEqual({ ...before, payment_method_link_request_key: 'request-key' });
    expect(await paymentRepository.count()).toBe(0);
    expect(kassa.createPayment).not.toHaveBeenCalled();
    expect(kassa.chargeQr).not.toHaveBeenCalled();
  });

  it('Должен возвращать конфликт без собственной подписки, не затрагивая чужую', async () => {
    const other = await userRepository.save({ email: 'other@example.com' });
    const subscription = await createSubscription(
      subscriptionRepository,
      other,
    );

    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(409);

    expect(kassa.addAccountQr).not.toHaveBeenCalled();
    expect(
      (await subscriptionRepository.findOneByOrFail({ id: subscription.id }))
        .payment_method_link_request_key,
    ).toBeNull();
  });

  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED])(
    'Должен атомарно заменять реквизиты без изменения подписки со статусом %s и без оплаты',
    async (status) => {
      const subscription = await createSubscription(
        subscriptionRepository,
        currentUser,
        {
          status,
          rebill_id: 123,
          tpay_card_mask: '**** 0777',
          account_token: 'old-sbp-token',
          sbp_bank_name: 'Старый банк',
          six_months: true,
          is_trial: true,
        },
      );
      const before = await subscriptionRepository.findOneByOrFail({
        id: subscription.id,
      });
      await request(app.getHttpServer())
        .post('/api/payment/method/generate-qr')
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/webhook/notify')
        .send(
          createAccountLinkNotification({
            AccountToken: 'new-token',
            BankMemberName: 'Новый банк',
          }),
        )
        .expect(200)
        .expect('OK');

      expect(
        await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).toEqual({
        ...before,
        rebill_id: null,
        tpay_card_mask: null,
        account_token: 'new-token',
        sbp_bank_name: 'Новый банк',
        payment_method_link_request_key: null,
      });
      await request(app.getHttpServer())
        .get('/api/payment/method')
        .expect(200)
        .expect({ type: 'sbp', description: 'Новый банк' });
      expect(await paymentRepository.count()).toBe(0);
      expect(kassa.createPayment).not.toHaveBeenCalled();
      expect(kassa.chargeQr).not.toHaveBeenCalled();
    },
  );

  it('Не должен менять способ при неуспешной привязке', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      {
        rebill_id: 123,
        tpay_card_mask: '**** 0777',
      },
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    const before = await subscriptionRepository.findOneByOrFail({
      id: subscription.id,
    });
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(
        createAccountLinkNotification({
          Status: LINK_ACCOUNT_NOTIFICATION_STATUSES.INACTIVE,
          Success: false,
        }),
      )
      .expect(200);
    expect(
      await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).toEqual(before);
  });

  it('Должен безопасно обрабатывать одновременные и повторные уведомления', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      { rebill_id: 123 },
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/api/webhook/notify')
          .send(createAccountLinkNotification())
          .expect(200),
      ),
    );
    const before = await subscriptionRepository.findOneByOrFail({
      id: subscription.id,
    });
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createAccountLinkNotification())
      .expect(200);
    expect(
      await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).toEqual(before);
    expect(await paymentRepository.count()).toBe(0);
    expect(kassa.chargeQr).not.toHaveBeenCalled();
  });

  it('Не должен принимать старый QR после выдачи нового или затирать новую привязку повтором старой', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      { rebill_id: 123 },
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    kassa.addAccountQr.mockResolvedValueOnce({
      RequestKey: 'new-key',
      Data: '<svg>new</svg>',
    });
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createAccountLinkNotification())
      .expect(200);
    expect(
      String(
        (await subscriptionRepository.findOneByOrFail({ id: subscription.id }))
          .rebill_id,
      ),
    ).toBe('123');
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(
        createAccountLinkNotification({
          RequestKey: 'new-key',
          AccountToken: 'new-token',
        }),
      )
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createAccountLinkNotification())
      .expect(200);
    expect(
      (await subscriptionRepository.findOneByOrFail({ id: subscription.id }))
        .account_token,
    ).toBe('new-token');
    expect(kassa.chargeQr).not.toHaveBeenCalled();
  });

  it('Не должен менять реквизиты при истёкшем контексте или невалидном токене', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      { rebill_id: 123 },
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    const before = await subscriptionRepository.findOneByOrFail({
      id: subscription.id,
    });
    kassa.checkToken.mockReturnValueOnce(false);
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createAccountLinkNotification())
      .expect(400);
    await cache.clear();
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createAccountLinkNotification())
      .expect(400);
    expect(
      await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).toEqual(before);
    expect(kassa.chargeQr).not.toHaveBeenCalled();
  });

  it('Должен сохранять реквизиты и предыдущий QR при ошибке банка', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
      { rebill_id: 123 },
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(201);
    const before = await subscriptionRepository.findOneByOrFail({
      id: subscription.id,
    });
    kassa.addAccountQr.mockRejectedValueOnce(
      new InternalServerErrorException('Bank unavailable'),
    );
    await request(app.getHttpServer())
      .post('/api/payment/method/generate-qr')
      .expect(500);
    expect(
      await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).toEqual(before);
  });
});
