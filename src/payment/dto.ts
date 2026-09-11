import { IsBoolean, IsIn } from 'class-validator';
import { SubscriptionPlan } from 'src/entities/Subscription';

export class TariffInfoDto {
  @IsIn([SubscriptionPlan.PLUS, SubscriptionPlan.PRO])
  tariff: SubscriptionPlan;

  @IsBoolean()
  sixMonths: boolean;
}
