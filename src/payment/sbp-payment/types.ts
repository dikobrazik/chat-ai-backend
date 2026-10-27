import { SubscriptionPlan } from 'src/entities/Subscription';

export type CachedPurchaseRequestParams = {
  purpose?: 'purchase';
  tariffId: SubscriptionPlan;
  sixMonths: boolean;
  userId: string;
  userEmail: string;
};

export type CachedMethodChangeRequestParams = {
  purpose: 'method_change';
  subscriptionId: string;
  userId: string;
};

export type CachedRequestParams =
  | CachedPurchaseRequestParams
  | CachedMethodChangeRequestParams;
