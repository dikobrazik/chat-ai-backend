import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  SubscriptionNotification,
  SubscriptionNotificationStatus,
  SubscriptionNotificationType,
} from 'src/entities/SubscriptionNotification';
import { QueryFailedError, Repository } from 'typeorm';

const UNIQUE_NOTIFICATION_PERIOD_CONSTRAINT =
  'UQ_subscription_notification_subscription_type_period';

@Injectable()
export class SubscriptionNotificationService {
  @InjectRepository(SubscriptionNotification)
  private readonly notificationRepository: Repository<SubscriptionNotification>;

  public async claimChargeReminder(
    subscriptionId: string,
    periodEnd: Date,
  ): Promise<boolean> {
    try {
      await this.notificationRepository.insert({
        subscription_id: subscriptionId,
        type: SubscriptionNotificationType.CHARGE_REMINDER,
        period_end: periodEnd,
        status: SubscriptionNotificationStatus.PROCESSING,
      });

      return true;
    } catch (error) {
      if (!this.isExistingNotificationViolation(error)) {
        throw error;
      }
    }

    const result = await this.notificationRepository.update(
      {
        subscription_id: subscriptionId,
        type: SubscriptionNotificationType.CHARGE_REMINDER,
        period_end: periodEnd,
        status: SubscriptionNotificationStatus.FAILED,
      },
      {
        status: SubscriptionNotificationStatus.PROCESSING,
        attempts: () => '"attempts" + 1',
      },
    );

    return result.affected === 1;
  }

  public markChargeReminderSent(subscriptionId: string, periodEnd: Date) {
    return this.notificationRepository.update(
      {
        subscription_id: subscriptionId,
        type: SubscriptionNotificationType.CHARGE_REMINDER,
        period_end: periodEnd,
        status: SubscriptionNotificationStatus.PROCESSING,
      },
      {
        status: SubscriptionNotificationStatus.SENT,
        sent_at: new Date(),
      },
    );
  }

  public markChargeReminderFailed(subscriptionId: string, periodEnd: Date) {
    return this.notificationRepository.update(
      {
        subscription_id: subscriptionId,
        type: SubscriptionNotificationType.CHARGE_REMINDER,
        period_end: periodEnd,
        status: SubscriptionNotificationStatus.PROCESSING,
      },
      {
        status: SubscriptionNotificationStatus.FAILED,
      },
    );
  }

  private isExistingNotificationViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === UNIQUE_NOTIFICATION_PERIOD_CONSTRAINT
    );
  }
}
