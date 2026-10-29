import 'reflect-metadata';

import {
  BadGatewayException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { type Request } from 'express';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { PaymentAmountService } from 'src/payment/payment-amount.service';
import { PaymentController } from 'src/payment/payment.controller';
import { PaymentService } from 'src/payment/payment.service';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TbankPaymentService } from 'src/payment/tbank-payment/tbank-payment.service';
import { TinkoffKassaService } from 'src/payment/tinkoff-kassa/tinkoff-kassa.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { WebhookController } from 'src/payment/webhook/webhook.controller';
import { WebhookService } from 'src/payment/webhook/webhook.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionCheckService } from 'src/subscription/cron/subscription-check.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';
import { UserService } from 'src/user/user.service';
import { createPaymentNotification } from './fixtures';

jest.setTimeout(120_000);

describe('POST /api/payment/get-tbank-link (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let currentUser: User;
  let users: Repository<User>;
  let subscriptions: Repository<Subscription>;
  let payments: Repository<Payment>;
  const kassa = {
    createPayment: jest.fn(),
    checkToken: jest.fn(),
    charge: jest.fn(),
    checkTPayLink: jest.fn(),
    getTPayLink: jest.fn(),
  };
  const promotion = {
    getFirstSubscriptionPromotion: jest.fn(),
    getSixMonthsSubscriptionPromotion: jest.fn(),
    markPromotionAsUsed: jest.fn(),
  };
  const userService = { resetSubscription: jest.fn() };
  const sbp = { charge: jest.fn(), onAccountLinked: jest.fn() };
  const PaymentURL = 'https://securepay.tinkoff.ru/payment';

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
      controllers: [PaymentController, WebhookController],
      providers: [
        TbankPaymentService,
        TpayPaymentService,
        PaymentService,
        PaymentAmountService,
        SubscriptionService,
        SubscriptionCheckService,
        TariffService,
        WebhookService,
        { provide: SbpPaymentService, useValue: sbp },
        { provide: TinkoffKassaService, useValue: kassa },
        { provide: PromotionService, useValue: promotion },
        { provide: UserService, useValue: userService },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.use((req: Request, _res, next) => {
      req.user = currentUser;
      next();
    });
    await app.init();
    users = moduleRef.get(getRepositoryToken(User));
    subscriptions = moduleRef.get(getRepositoryToken(Subscription));
    payments = moduleRef.get(getRepositoryToken(Payment));
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    kassa.createPayment.mockResolvedValue({
      Success: true,
      PaymentId: '123',
      PaymentURL,
    });
    kassa.checkToken.mockReturnValue(true);
    currentUser = await users.save({
      email: 'tbank@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    if (payments) await payments.createQueryBuilder().delete().execute();
    if (subscriptions)
      await subscriptions.createQueryBuilder().delete().execute();
    if (users) await users.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    if (app) await app.close();
    else if (moduleRef) await moduleRef.close();
    await container?.stop();
  });

  it('Должен создать платёж текущего пользователя и вернуть обычную форму без вызова API T-Pay', async () => {
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({
        tariff: SubscriptionPlan.PLUS,
        sixMonths: true,
        amount: 1,
        user_id: 'another-user',
      })
      .expect(201)
      .expect({ PaymentURL });

    const subscription = await subscriptions.findOneByOrFail({
      user_id: currentUser.id,
    });
    const payment = await payments.findOneByOrFail({
      subscription_id: subscription.id,
    });
    expect(subscription).toMatchObject({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.PENDING,
      six_months: true,
    });
    expect(payment).toMatchObject({
      user_id: currentUser.id,
      amount: 6_000,
      status: PaymentStatus.NEW,
      external_payment_id: '123',
    });
    expect(kassa.createPayment).toHaveBeenCalledWith({
      OrderId: payment.id,
      Amount: 6_000,
      CustomerKey: currentUser.id,
      Email: currentUser.email,
      DATA: { OperationInitiatorType: '1' },
    });
    expect(kassa.checkTPayLink).not.toHaveBeenCalled();
    expect(kassa.getTPayLink).not.toHaveBeenCalled();
    expect(kassa.charge).not.toHaveBeenCalled();
    expect((await users.findOneByOrFail({ id: currentUser.id })).status).toBe(
      UserStatus.ACTIVE,
    );
  });

  it('Должен учитывать пробный период и списывать 1000 копеек при первой оплате', async () => {
    promotion.getFirstSubscriptionPromotion.mockResolvedValue({ freeDays: 3 });
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PLUS, sixMonths: false })
      .expect(201);
    expect(
      (await subscriptions.findOneByOrFail({ user_id: currentUser.id }))
        .is_trial,
    ).toBe(true);
    expect(
      (await payments.findOneByOrFail({ user_id: currentUser.id })).amount,
    ).toBe(1_000);
    expect(kassa.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ Amount: 1_000 }),
    );
  });

  it('Должен учитывать скидку на шесть месяцев', async () => {
    promotion.getSixMonthsSubscriptionPromotion.mockResolvedValue({
      discount: 20,
    });
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PRO, sixMonths: true })
      .expect(201);
    expect(
      (await payments.findOneByOrFail({ user_id: currentUser.id })).amount,
    ).toBe(9_600);
  });

  it('Должен сохранять RebillId после оплаты картой и продлевать подписку существующим кроном', async () => {
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PRO, sixMonths: false })
      .expect(201);
    const payment = await payments.findOneByOrFail({ user_id: currentUser.id });
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(createPaymentNotification({ OrderId: payment.id, RebillId: 789 }))
      .expect(200);
    const subscription = await subscriptions.findOneByOrFail({
      user_id: currentUser.id,
    });
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(subscription.rebill_id).toBe('789');
    expect(subscription.pan).toBe('430000******0777');
    await subscriptions.update(subscription.id, {
      current_period_end: new Date(Date.now() - 1_000),
    });
    kassa.createPayment.mockResolvedValueOnce({ PaymentId: '124' });

    await moduleRef.get(SubscriptionCheckService).handleSubscriptionCheck();

    expect(kassa.createPayment).toHaveBeenLastCalledWith({
      OrderId: expect.any(String),
      Amount: 2_000,
      CustomerKey: currentUser.id,
      Email: currentUser.email,
      DATA: { OperationInitiatorType: 'R' },
    });
    expect(kassa.charge).toHaveBeenCalledWith('124', '789', currentUser.email);
    expect(sbp.charge).not.toHaveBeenCalled();
    const allPayments = await payments.findBy({ user_id: currentUser.id });
    expect(allPayments).toHaveLength(2);
    const renewal = allPayments.find((entry) => entry.id !== payment.id);
    expect(renewal).toMatchObject({
      subscription_id: subscription.id,
      amount: 2_000,
      status: PaymentStatus.NEW,
    });
  });

  it('Не должен обещать продление при оплате без сохранённых реквизитов', async () => {
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PLUS, sixMonths: false })
      .expect(201);
    const payment = await payments.findOneByOrFail({ user_id: currentUser.id });
    await request(app.getHttpServer())
      .post('/api/webhook/notify')
      .send(
        createPaymentNotification({ OrderId: payment.id, RebillId: undefined }),
      )
      .expect(200);
    const subscription = await subscriptions.findOneByOrFail({
      user_id: currentUser.id,
    });
    expect(subscription.rebill_id).toBeNull();
    await subscriptions.update(subscription.id, {
      current_period_end: new Date(Date.now() - 1_000),
    });

    await moduleRef.get(SubscriptionCheckService).handleSubscriptionCheck();

    expect(kassa.charge).not.toHaveBeenCalled();
    expect(sbp.charge).not.toHaveBeenCalled();
    expect(userService.resetSubscription).toHaveBeenCalledWith(currentUser.id);
    expect(
      (await subscriptions.findOneByOrFail({ id: subscription.id })).status,
    ).toBe(SubscriptionStatus.EXPIRED);
  });

  it('Должен возвращать ошибку при отсутствии PaymentURL, сохраняя внешний ID', async () => {
    kassa.createPayment.mockResolvedValueOnce({ PaymentId: '123' });
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PLUS, sixMonths: false })
      .expect(502);
    expect(
      (await payments.findOneByOrFail({ user_id: currentUser.id }))
        .external_payment_id,
    ).toBe('123');
  });

  it('Должен возвращать ошибку банка без активации подписки', async () => {
    kassa.createPayment.mockRejectedValueOnce(
      new BadGatewayException('Bank unavailable'),
    );
    await request(app.getHttpServer())
      .post('/api/payment/get-tbank-link')
      .send({ tariff: SubscriptionPlan.PLUS, sixMonths: false })
      .expect(502);
    expect(
      (await subscriptions.findOneByOrFail({ user_id: currentUser.id })).status,
    ).toBe(SubscriptionStatus.PENDING);
    expect(
      (await payments.findOneByOrFail({ user_id: currentUser.id }))
        .external_payment_id,
    ).toBeNull();
  });

  it.each([
    { tariff: SubscriptionPlan.BASE, sixMonths: false },
    { tariff: SubscriptionPlan.PLUS, sixMonths: 'false' },
    { tariff: SubscriptionPlan.PLUS },
  ])(
    'Должен отклонять невалидные параметры до создания платежа (%j)',
    async (body) => {
      await request(app.getHttpServer())
        .post('/api/payment/get-tbank-link')
        .send(body)
        .expect(400);
      expect(await payments.count()).toBe(0);
      expect(await subscriptions.count()).toBe(0);
      expect(kassa.createPayment).not.toHaveBeenCalled();
    },
  );
});
