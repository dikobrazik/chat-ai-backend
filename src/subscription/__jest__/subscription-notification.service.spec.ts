import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, type Mocked } from '@suites/unit';
import {
  SubscriptionNotification,
  SubscriptionNotificationStatus,
  SubscriptionNotificationType,
} from 'src/entities/SubscriptionNotification';
import {
  InsertResult,
  QueryFailedError,
  type Repository,
  UpdateResult,
} from 'typeorm';
import { SubscriptionNotificationService } from '../subscription-notification.service';

const notificationRepositoryToken = getRepositoryToken(
  SubscriptionNotification,
) as string;
const PERIOD_END = new Date('2026-09-20T08:00:00.000Z');
const UNIQUE_NOTIFICATION_PERIOD_CONSTRAINT =
  'UQ_subscription_notification_subscription_type_period';

const createUpdateResult = (affected: number) => {
  const result = new UpdateResult();
  result.affected = affected;
  return result;
};

describe(SubscriptionNotificationService.name, () => {
  let notificationService: SubscriptionNotificationService;
  let notificationRepositoryMock: Mocked<Repository<SubscriptionNotification>>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      SubscriptionNotificationService,
    )
      .mock(notificationRepositoryToken)
      .impl(() => ({
        insert: jest.fn(),
        update: jest.fn(),
      }))
      .compile();

    notificationService = unit;
    notificationRepositoryMock = unitRef.get(notificationRepositoryToken);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Должен захватить новое уведомление', async () => {
    notificationRepositoryMock.insert.mockResolvedValueOnce(new InsertResult());

    await expect(
      notificationService.claimChargeReminder('subscription-id', PERIOD_END),
    ).resolves.toBe(true);

    expect(notificationRepositoryMock.insert).toHaveBeenCalledWith({
      subscription_id: 'subscription-id',
      type: SubscriptionNotificationType.CHARGE_REMINDER,
      period_end: PERIOD_END,
      status: SubscriptionNotificationStatus.PROCESSING,
    });
  });

  it('Не должен захватывать уже обрабатываемое или отправленное уведомление', async () => {
    notificationRepositoryMock.insert.mockRejectedValueOnce(
      new QueryFailedError(
        '',
        [],
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: UNIQUE_NOTIFICATION_PERIOD_CONSTRAINT,
        }),
      ),
    );
    notificationRepositoryMock.update.mockResolvedValueOnce(
      createUpdateResult(0),
    );

    await expect(
      notificationService.claimChargeReminder('subscription-id', PERIOD_END),
    ).resolves.toBe(false);
  });

  it('Должен повторно захватить уведомление после ошибки отправки', async () => {
    notificationRepositoryMock.insert.mockRejectedValueOnce(
      new QueryFailedError(
        '',
        [],
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: UNIQUE_NOTIFICATION_PERIOD_CONSTRAINT,
        }),
      ),
    );
    notificationRepositoryMock.update.mockResolvedValueOnce(
      createUpdateResult(1),
    );

    await expect(
      notificationService.claimChargeReminder('subscription-id', PERIOD_END),
    ).resolves.toBe(true);

    expect(notificationRepositoryMock.update).toHaveBeenCalledWith(
      {
        subscription_id: 'subscription-id',
        type: SubscriptionNotificationType.CHARGE_REMINDER,
        period_end: PERIOD_END,
        status: SubscriptionNotificationStatus.FAILED,
      },
      {
        status: SubscriptionNotificationStatus.PROCESSING,
        attempts: expect.any(Function),
      },
    );
  });

  it('Должен пробрасывать ошибку базы данных, не связанную с уникальностью', async () => {
    const databaseError = new QueryFailedError(
      '',
      [],
      Object.assign(new Error('connection failed'), { code: '08006' }),
    );
    notificationRepositoryMock.insert.mockRejectedValueOnce(databaseError);

    await expect(
      notificationService.claimChargeReminder('subscription-id', PERIOD_END),
    ).rejects.toBe(databaseError);
  });
});
