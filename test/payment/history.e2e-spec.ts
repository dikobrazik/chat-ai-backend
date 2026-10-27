import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { type Request } from 'express';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { PaymentController } from 'src/payment/payment.controller';
import { PaymentService } from 'src/payment/payment.service';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { createPayment, createSubscription } from './fixtures';

jest.setTimeout(120_000);

describe('GET /api/payment/history (интеграционный тест)', () => {
  const now = new Date('2026-09-11T08:00:00.000Z');
  const nextChargeAt = new Date('2026-10-11T08:00:00.000Z');
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let currentUser: User;
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
      controllers: [PaymentController],
      providers: [
        PaymentService,
        {
          provide: SbpPaymentService,
          useValue: { getAddAccountQr: jest.fn() },
        },
        {
          provide: TpayPaymentService,
          useValue: { getTPayLink: jest.fn() },
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
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    currentUser = await userRepository.save({
      email: 'history@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    if (!paymentRepository || !subscriptionRepository || !userRepository) {
      return;
    }

    await paymentRepository.createQueryBuilder().delete().execute();
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
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
  });

  it('Должен возвращать пустую историю, если нет завершённых платежей', async () => {
    await createPayment(paymentRepository, subscriptionRepository, currentUser);

    await request(app.getHttpServer())
      .get('/api/payment/history')
      .expect(200)
      .expect([]);
  });

  it('Должен возвращать только свои завершённые платежи, новые первыми, неизвестные даты последними', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
    );
    const otherUser = await userRepository.save({
      email: 'other@example.com',
      status: UserStatus.ACTIVE,
    });
    const otherSubscription = await createSubscription(
      subscriptionRepository,
      otherUser,
    );
    const fixtures = [
      { status: PaymentStatus.REJECTED, payment_date: null },
      {
        status: PaymentStatus.CONFIRMED,
        payment_date: new Date('2026-09-09T08:00:00.000Z'),
        receipt_url: 'https://ofd.example.com/receipt/1',
      },
      { status: PaymentStatus.NEW, payment_date: now },
      { status: PaymentStatus.FORM_SHOWN, payment_date: now },
      { status: PaymentStatus.REFUNDED, payment_date: now },
      { status: PaymentStatus.REJECTED, payment_date: now },
      { status: PaymentStatus.CONFIRMED, payment_date: null },
    ];
    const payments = await paymentRepository.save(
      fixtures.map((fixture, index) => ({
        id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        user_id: currentUser.id,
        subscription_id: subscription.id,
        external_payment_id: `private-external-${index}`,
        amount: 2_000 + index,
        receipt_url: null,
        ...fixture,
      })),
    );
    await paymentRepository.save({
      user_id: otherUser.id,
      subscription_id: otherSubscription.id,
      status: PaymentStatus.CONFIRMED,
      amount: 10_000,
      payment_date: nextChargeAt,
    });

    const response = await request(app.getHttpServer())
      .get('/api/payment/history')
      .expect(200);

    expect(response.body).toEqual(
      [5, 4, 1, 6, 0].map((index) => ({
        id: payments[index].id,
        amount: payments[index].amount,
        status: payments[index].status,
        payment_date: fixtures[index].payment_date?.toISOString() ?? null,
        receipt_url: fixtures[index].receipt_url ?? null,
      })),
    );
  });

  it('Должен возвращать всю историю без серверного ограничения в пять записей', async () => {
    const subscription = await createSubscription(
      subscriptionRepository,
      currentUser,
    );
    await paymentRepository.save(
      Array.from({ length: 7 }, () => ({
        user_id: currentUser.id,
        subscription_id: subscription.id,
        amount: 100,
        status: PaymentStatus.CONFIRMED,
        payment_date: now,
      })),
    );

    const response = await request(app.getHttpServer())
      .get('/api/payment/history')
      .expect(200);

    expect(response.body).toHaveLength(7);
  });
});
