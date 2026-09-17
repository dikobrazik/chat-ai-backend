import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import {
  SubscriptionNotification,
  SubscriptionNotificationStatus,
  SubscriptionNotificationType,
} from 'src/entities/SubscriptionNotification';
import { User, UserStatus } from 'src/entities/User';
import { SubscriptionNotificationService } from 'src/subscription/subscription-notification.service';
import { Repository } from 'typeorm';

jest.setTimeout(120_000);

const PERIOD_END = new Date('2026-10-20T08:00:00.000Z');

describe('SubscriptionNotificationService (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let notificationService: SubscriptionNotificationService;
  let userRepository: Repository<User>;
  let subscriptionRepository: Repository<Subscription>;
  let notificationRepository: Repository<SubscriptionNotification>;

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
          entities: [User, Subscription, SubscriptionNotification],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([
          User,
          Subscription,
          SubscriptionNotification,
        ]),
      ],
      providers: [SubscriptionNotificationService],
    }).compile();

    notificationService = moduleRef.get(SubscriptionNotificationService);
    userRepository = moduleRef.get(getRepositoryToken(User));
    subscriptionRepository = moduleRef.get(getRepositoryToken(Subscription));
    notificationRepository = moduleRef.get(
      getRepositoryToken(SubscriptionNotification),
    );
  });

  afterEach(async () => {
    if (!notificationRepository || !subscriptionRepository || !userRepository) {
      return;
    }

    await notificationRepository.createQueryBuilder().delete().execute();
    await subscriptionRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
  });

  it('Должен атомарно захватывать уведомление и разрешать повтор только после ошибки', async () => {
    const user = await userRepository.save({
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
    });
    const subscription = await subscriptionRepository.save({
      user_id: user.id,
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_start: new Date('2026-09-20T08:00:00.000Z'),
      current_period_end: PERIOD_END,
    });

    const claimResults = await Promise.all([
      notificationService.claimChargeReminder(subscription.id, PERIOD_END),
      notificationService.claimChargeReminder(subscription.id, PERIOD_END),
    ]);

    expect(claimResults.filter(Boolean)).toHaveLength(1);
    await expect(notificationRepository.count()).resolves.toBe(1);

    let notification = await notificationRepository.findOneByOrFail({
      subscription_id: subscription.id,
      type: SubscriptionNotificationType.CHARGE_REMINDER,
      period_end: PERIOD_END,
    });

    expect(notification).toMatchObject({
      status: SubscriptionNotificationStatus.PROCESSING,
      attempts: 1,
      sent_at: null,
    });

    await notificationService.markChargeReminderFailed(
      subscription.id,
      PERIOD_END,
    );

    await expect(
      notificationService.claimChargeReminder(subscription.id, PERIOD_END),
    ).resolves.toBe(true);

    await notificationService.markChargeReminderSent(
      subscription.id,
      PERIOD_END,
    );

    await expect(
      notificationService.claimChargeReminder(subscription.id, PERIOD_END),
    ).resolves.toBe(false);

    notification = await notificationRepository.findOneByOrFail({
      subscription_id: subscription.id,
      type: SubscriptionNotificationType.CHARGE_REMINDER,
      period_end: PERIOD_END,
    });

    expect(notification).toMatchObject({
      status: SubscriptionNotificationStatus.SENT,
      attempts: 2,
    });
    expect(notification.sent_at).toBeInstanceOf(Date);
  });
});
