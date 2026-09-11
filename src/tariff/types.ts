import { SubscriptionPlan } from 'src/entities/Subscription';

export type Tariff = {
  id: SubscriptionPlan;
  name: string;
  price: number;
  freeDays?: number;
  discount?: number;
  isPopular?: boolean;
  nextChargeAt?: Date | null;
  description: string;
  features: string[];
};
