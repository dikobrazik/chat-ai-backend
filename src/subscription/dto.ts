import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '../entities/Subscription';

export class InitSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
