import { addDays, addMonths } from 'date-fns';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';

export class SubscriptionFactory {
  public static createSubscription(
    tariffId: SubscriptionPlan,
    userId: string,
    periodEnd: Date,
  ): Subscription {
    const subscription = new Subscription();
    subscription.user_id = userId;
    subscription.status = SubscriptionStatus.PENDING;
    subscription.plan = tariffId;
    subscription.current_period_start = new Date();
    subscription.current_period_end = periodEnd;

    return subscription;
  }

  public static getPeriodEnd(sixMonths: boolean, freeDays: number) {
    let currentPeriodEnd = new Date();

    if (sixMonths) {
      currentPeriodEnd = addMonths(currentPeriodEnd, 6);
    } else {
      if (freeDays) {
        currentPeriodEnd = addDays(currentPeriodEnd, freeDays ?? 0);
      } else {
        currentPeriodEnd = addMonths(currentPeriodEnd, 1);
      }
    }
    return currentPeriodEnd;
  }
}
