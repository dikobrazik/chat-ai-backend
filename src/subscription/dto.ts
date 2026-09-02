import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { SubscriptionPlan } from 'src/entities/Subscription';

export class InitSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsBoolean()
  sixMonths: boolean;
}

export class LinkSbpAccountDto {
  @IsUUID()
  bankId: string;
}
