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

jest.setTimeout(120_000);

describe('SubscriptionController (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let app: INestApplication;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let currentUser: User;

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
        { provide: TariffService, useValue: { getTariff: jest.fn() } },
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
    });
    expect(response.body).not.toHaveProperty('rebill_id');
  });

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
