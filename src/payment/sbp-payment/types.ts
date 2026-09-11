import { SubscriptionPlan } from 'src/entities/Subscription';

export type CachedRequestParams = {
  tariffId: SubscriptionPlan;
  sixMonths: boolean;
  userId: string;
  userEmail: string;
};
