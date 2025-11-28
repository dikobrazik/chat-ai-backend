import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from 'src/entities/Subscription';

export class InitSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
