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
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { SubscriptionController } from 'src/subscription/subscription.controller';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { TariffService } from 'src/tariff/tariff.service';
import { PromotionService } from 'src/promotion/promotion.service';

jest.setTimeout(120_000);

const NOW = new Date('2026-09-11T08:00:00.000Z');
const PERIOD_END = new Date('2026-10-11T08:00:00.000Z');

describe('SubscriptionController (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let currentUser: User;
  const promotionServiceMock = {
    getFirstSubscriptionPromotion: jest.fn(),
    getSixMonthsSubscriptionPromotion: jest.fn(),
  };

  async function createSubscription(overrides: Partial<Subscription> = {}) {
    currentUser = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.SUBSCRIPTION_PLUS,
    });

    const subscription = await subscriptionRepository.save({
      user_id: currentUser.id,
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: NOW,
      current_period_end: PERIOD_END,
      rebill_id: 123,
      account_token: 'private-account-token',
      ...overrides,
    });

    return subscriptionRepository.findOneByOrFail({ id: subscription.id });
  }

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
          entities: [User, Subscription],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([User, Subscription]),
      ],
      controllers: [SubscriptionController],
      providers: [
        SubscriptionService,
        TariffService,
        { provide: PromotionService, useValue: promotionServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res, next) => {
      req.user = currentUser;
      next();
    });
    await app.init();

    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
  });

  beforeEach(() => {
    jest.resetAllMocks();
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
    jest.setSystemTime(NOW);
    promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValue(null);
    promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValue({
      discount: 10,
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (!subscriptionRepository || !userRepository) {
      return;
    }

    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (container) {
      await container.stop();
    }
  });

  it('Должен возвращать активную подписку пользователя без RebillId', async () => {
    currentUser = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.SUBSCRIPTION_PLUS,
    });
    await subscriptionRepository.save({
      user_id: currentUser.id,
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: new Date('2026-09-11T08:00:00.000Z'),
      current_period_end: new Date('2026-10-11T08:00:00.000Z'),
      rebill_id: 123,
    });

    const response = await request(app.getHttpServer())
      .get('/subscription')
      .expect(200);

    expect(response.body).toEqual({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_end: '2026-10-11T08:00:00.000Z',
      next_payment_amount: 1_000,
      is_trial: false,
    });
    expect(response.body).not.toHaveProperty('rebill_id');
  });

  it('Должен возвращать отменённую подписку и оплаченный доступ после отключения автопродления', async () => {
    await createSubscription();

    await request(app.getHttpServer()).post('/subscription/cancel').expect(201);
    const response = await request(app.getHttpServer())
      .get('/subscription')
      .expect(200);

    expect(response.body).toEqual({
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.CANCELED,
      current_period_end: PERIOD_END.toISOString(),
      next_payment_amount: 1_000,
      is_trial: false,
    });
    expect(response.body).not.toHaveProperty('account_token');
    expect(response.body).not.toHaveProperty('rebill_id');
    expect(response.body).not.toHaveProperty('user_id');
  });

  describe('POST /subscription/resume', () => {
    it.each([
      { method: 'T-Pay', rebill_id: 123, account_token: null },
      { method: 'СБП', rebill_id: null, account_token: 'account-token' },
    ])(
      'Должен возобновлять подписку со способом $method без изменения периода и тарифа',
      async ({ rebill_id, account_token }) => {
        const subscription = await createSubscription({
          status: SubscriptionStatus.CANCELED,
          six_months: true,
          rebill_id,
          account_token,
        });

        const response = await request(app.getHttpServer())
          .post('/subscription/resume')
          .expect(201);

        expect(response.text).toBe('');
        await expect(
          subscriptionRepository.findOneByOrFail({ id: subscription.id }),
        ).resolves.toEqual({
          ...subscription,
          status: SubscriptionStatus.ACTIVE,
        });
        const current = await request(app.getHttpServer())
          .get('/subscription')
          .expect(200);
        expect(current.body).toMatchObject({
          status: SubscriptionStatus.ACTIVE,
          current_period_end: PERIOD_END.toISOString(),
          next_payment_amount: 5_400,
        });
      },
    );

    it('Должен возобновлять отменённый пробный период без его продления и сброса', async () => {
      const subscription = await createSubscription({
        status: SubscriptionStatus.CANCELED,
        is_trial: true,
        current_period_end: new Date('2026-09-14T08:00:00.000Z'),
      });

      await request(app.getHttpServer())
        .post('/subscription/resume')
        .expect(201);

      await expect(
        subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).resolves.toEqual({
        ...subscription,
        status: SubscriptionStatus.ACTIVE,
      });
    });

    it.each([
      { rebill_id: null, account_token: null },
      { rebill_id: null, account_token: '' },
      { rebill_id: 0, account_token: null },
      { rebill_id: -1, account_token: null },
    ])(
      'Должен возвращать 409 без способа оплаты: rebill_id=$rebill_id, account_token=$account_token',
      async ({ rebill_id, account_token }) => {
        const subscription = await createSubscription({
          status: SubscriptionStatus.CANCELED,
          rebill_id,
          account_token,
        });

        await request(app.getHttpServer())
          .post('/subscription/resume')
          .expect(409);

        await expect(
          subscriptionRepository.findOneByOrFail({ id: subscription.id }),
        ).resolves.toEqual(subscription);
      },
    );

    it.each([NOW, new Date('2026-09-10T08:00:00.000Z'), null])(
      'Должен возвращать 409 без действующего оплаченного периода: %s',
      async (end) => {
        const subscription = await createSubscription({
          status: SubscriptionStatus.CANCELED,
          current_period_end: end,
        });

        await request(app.getHttpServer())
          .post('/subscription/resume')
          .expect(409);

        await expect(
          subscriptionRepository.findOneByOrFail({ id: subscription.id }),
        ).resolves.toEqual(subscription);
      },
    );

    it.each([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.PENDING,
      SubscriptionStatus.RENEWING,
      SubscriptionStatus.FAILED,
      SubscriptionStatus.EXPIRED,
    ])(
      'Должен возвращать 409, если подписка не отменена: %s',
      async (status) => {
        const subscription = await createSubscription({ status });

        await request(app.getHttpServer())
          .post('/subscription/resume')
          .expect(409);

        await expect(
          subscriptionRepository.findOneByOrFail({ id: subscription.id }),
        ).resolves.toEqual(subscription);
      },
    );

    it('Должен возвращать 409, если своей подписки нет, и не изменять чужую', async () => {
      const subscription = await createSubscription({
        status: SubscriptionStatus.CANCELED,
      });
      currentUser = await userRepository.save({
        email: 'other@example.com',
        status: UserStatus.ACTIVE,
      });

      await request(app.getHttpServer())
        .post('/subscription/resume')
        .expect(409);

      await expect(
        subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).resolves.toEqual(subscription);
    });

    it('Должен возвращать 409 при повторном возобновлении и не менять период', async () => {
      const subscription = await createSubscription({
        status: SubscriptionStatus.CANCELED,
      });

      await request(app.getHttpServer())
        .post('/subscription/resume')
        .expect(201);
      await request(app.getHttpServer())
        .post('/subscription/resume')
        .expect(409);

      await expect(
        subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).resolves.toEqual({
        ...subscription,
        status: SubscriptionStatus.ACTIVE,
      });
    });

    it('Должен возобновлять подписку только один раз при конкурентных запросах', async () => {
      const subscription = await createSubscription({
        status: SubscriptionStatus.CANCELED,
      });

      const responses = await Promise.all([
        request(app.getHttpServer()).post('/subscription/resume'),
        request(app.getHttpServer()).post('/subscription/resume'),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 409,
      ]);
      await expect(
        subscriptionRepository.findOneByOrFail({ id: subscription.id }),
      ).resolves.toEqual({
        ...subscription,
        status: SubscriptionStatus.ACTIVE,
      });
    });
  });

  it('Должен возвращать полную цену шестимесячного продления со скидкой в копейках', async () => {
    await createSubscription({ six_months: true });

    const response = await request(app.getHttpServer())
      .get('/subscription')
      .expect(200);

    expect(response.body.next_payment_amount).toBe(5_400);
    expect(response.body.is_trial).toBe(false);
  });

  it('Должен возвращать сохранённый пробный период, даже когда акция уже израсходована', async () => {
    await createSubscription({
      is_trial: true,
      current_period_end: new Date('2026-09-14T08:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .get('/subscription')
      .expect(200);

    expect(response.body).toMatchObject({
      is_trial: true,
      next_payment_amount: 1_000,
    });
  });

  it('Не должен считать оплаченный период пробным из-за текущих настроек акции', async () => {
    await createSubscription();
    promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValue({
      freeDays: 14,
    });

    const response = await request(app.getHttpServer())
      .get('/subscription')
      .expect(200);

    expect(response.body.is_trial).toBe(false);
    expect(response.body.next_payment_amount).toBe(1_000);
  });

  it.each([
    { status: SubscriptionStatus.CANCELED, end: NOW },
    {
      status: SubscriptionStatus.CANCELED,
      end: new Date('2026-09-10T08:00:00.000Z'),
    },
    { status: SubscriptionStatus.CANCELED, end: null },
    { status: SubscriptionStatus.PENDING, end: PERIOD_END },
    { status: SubscriptionStatus.RENEWING, end: PERIOD_END },
    { status: SubscriptionStatus.FAILED, end: PERIOD_END },
    { status: SubscriptionStatus.EXPIRED, end: PERIOD_END },
  ])(
    'Не должен возвращать подписку со статусом $status и концом периода $end',
    async ({ status, end }) => {
      await createSubscription({ status, current_period_end: end });

      const response = await request(app.getHttpServer())
        .get('/subscription')
        .expect(200);

      expect(response.body).toEqual({});
    },
  );

  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED])(
    'Не должен возвращать чужую подписку со статусом %s',
    async (status) => {
      const other = await userRepository.save({
        email: 'other@example.com',
        status: UserStatus.SUBSCRIPTION_PLUS,
      });
      await subscriptionRepository.save({
        user_id: other.id,
        plan: SubscriptionPlan.PLUS,
        status,
        current_period_end: PERIOD_END,
      });
      currentUser = await userRepository.save({
        email: 'user@example.com',
        status: UserStatus.ACTIVE,
      });

      const response = await request(app.getHttpServer())
        .get('/subscription')
        .expect(200);

      expect(response.body).toEqual({});
    },
  );

  it('Должен позволить только одному процессу захватить просроченную подписку для продления', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.SUBSCRIPTION_PLUS,
    });
    const subscription = await subscriptionRepository.save({
      user_id: user.id,
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: new Date('2026-08-11T08:00:00.000Z'),
      current_period_end: new Date('2026-09-11T08:00:00.000Z'),
    });

    const claimResults = await Promise.all([
      moduleRef
        .get(SubscriptionService)
        .claimExpiredSubscription(subscription.id),
      moduleRef
        .get(SubscriptionService)
        .claimExpiredSubscription(subscription.id),
    ]);

    expect(claimResults.filter(Boolean)).toHaveLength(1);
    await expect(
      subscriptionRepository.findOneByOrFail({ id: subscription.id }),
    ).resolves.toMatchObject({
      status: SubscriptionStatus.RENEWING,
    });
  });

  describe('Если подписка отсутствует', () => {
    it('Должен возвращать null', async () => {
      currentUser = await userRepository.save({
        email: 'user@example.com',
        status: UserStatus.SUBSCRIPTION_PLUS,
      });

      const response = await request(app.getHttpServer())
        .get('/subscription')
        .expect(200);

      expect(response.body).toEqual({});
    });
  });
});
