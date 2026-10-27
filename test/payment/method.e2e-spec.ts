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
import { Payment } from 'src/entities/Payment';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { PaymentController } from 'src/payment/payment.controller';
import { PaymentService } from 'src/payment/payment.service';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { createSubscription } from './fixtures';

jest.setTimeout(120_000);

describe('GET /api/payment/method (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let currentUser: User;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;

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
        TypeOrmModule.forFeature([User, Payment, Subscription]),
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
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    currentUser = await userRepository.save({
      email: 'method@example.com',
      status: UserStatus.ACTIVE,
    });
  });

  afterEach(async () => {
    if (!subscriptionRepository || !userRepository) {
      return;
    }
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    } else if (moduleRef) {
      await moduleRef.close();
    }
    await container?.stop();
  });

  it('Должен возвращать JSON null, если подписки и реквизитов нет', async () => {
    await request(app.getHttpServer())
      .get('/api/payment/method')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect('null');
  });

  it('Не должен возвращать реквизиты другого пользователя', async () => {
    const otherUser = await userRepository.save({
      email: 'other@example.com',
      status: UserStatus.ACTIVE,
    });
    await createSubscription(subscriptionRepository, otherUser, {
      rebill_id: 123,
      tpay_card_mask: '**** 0777',
    });

    await request(app.getHttpServer())
      .get('/api/payment/method')
      .expect(200)
      .expect('null');
  });

  it.each([
    {
      rebill_id: 123,
      account_token: null,
      tpay_card_mask: '**** 0777',
      sbp_bank_name: null,
      expected: { type: 'tpay', description: '**** 0777' },
    },
    {
      rebill_id: null,
      account_token: 'private-token',
      tpay_card_mask: null,
      sbp_bank_name: 'Тестовый банк',
      expected: { type: 'sbp', description: 'Тестовый банк' },
    },
    {
      rebill_id: 123,
      account_token: 'private-token',
      tpay_card_mask: '**** 0777',
      sbp_bank_name: 'Другой банк',
      expected: { type: 'tpay', description: '**** 0777' },
    },
    {
      rebill_id: 123,
      account_token: null,
      tpay_card_mask: null,
      sbp_bank_name: null,
      expected: { type: 'tpay', description: null },
    },
    {
      rebill_id: null,
      account_token: 'private-token',
      tpay_card_mask: null,
      sbp_bank_name: null,
      expected: { type: 'sbp', description: null },
    },
    {
      rebill_id: 0,
      account_token: '',
      tpay_card_mask: '**** 0777',
      sbp_bank_name: 'Удалённый банк',
      expected: null,
    },
  ])(
    'Должен возвращать только тип и описание для реквизитов $rebill_id / $account_token без изменения данных',
    async ({ expected, ...credentials }) => {
      const subscription = await createSubscription(
        subscriptionRepository,
        currentUser,
        credentials,
      );
      const before = await subscriptionRepository.findOneByOrFail({
        id: subscription.id,
      });

      const response = await request(app.getHttpServer())
        .get('/api/payment/method')
        .expect(200);

      expect(response.body).toEqual(expected);
      expect(
        await subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).toEqual(before);
    },
  );

  it.each(Object.values(SubscriptionStatus))(
    'Должен возвращать привязанный способ при статусе подписки %s',
    async (status) => {
      await createSubscription(subscriptionRepository, currentUser, {
        status,
        account_token: 'private-token',
        sbp_bank_name: 'Тестовый банк',
      });

      await request(app.getHttpServer())
        .get('/api/payment/method')
        .expect(200)
        .expect({ type: 'sbp', description: 'Тестовый банк' });
    },
  );
});
