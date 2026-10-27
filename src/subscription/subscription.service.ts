import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { add } from 'date-fns';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { TariffService } from 'src/tariff/tariff.service';
import { And, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';

@Injectable()
export class SubscriptionService {
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;

  @Inject(TariffService)
  private readonly tariffService: TariffService;

  public async createSubscription(
    tariffId: SubscriptionPlan,
    userId: string,
    sixMonths: boolean,
  ) {
    const tariff = await this.tariffService.getTariff(
      tariffId,
      userId,
      sixMonths,
    );

    const userSubscription = await this.subscriptionRepository.findOne({
      where: { user_id: userId },
    });

    const { id: subscriptionId } = await this.subscriptionRepository.save({
      id: userSubscription?.id,
      user_id: userId,
      status: SubscriptionStatus.PENDING,
      plan: tariff.id,
      current_period_start: new Date(),
      current_period_end: tariff.nextChargeAt,
      six_months: sixMonths,
      is_trial: Boolean(tariff.freeDays),
    });

    return { subscriptionId };
  }

  public updateAccountToken(
    subscriptionId: string,
    accountToken: string,
    bankName: string | null = null,
  ) {
    return this.subscriptionRepository.update(subscriptionId, {
      account_token: accountToken,
      sbp_bank_name: bankName,
    });
  }

  public updateRebillId(subscriptionId: string, rebillId: number) {
    return this.subscriptionRepository.update(subscriptionId, {
      rebill_id: rebillId,
    });
  }

  public getExpiredSubscriptions(
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
  ) {
    return this.subscriptionRepository.find({
      where: {
        current_period_end: LessThanOrEqual(new Date()),
        status,
      },
      relations: ['user'],
    });
  }

  public async claimExpiredSubscription(subscriptionId: string) {
    const result = await this.subscriptionRepository.update(
      {
        id: subscriptionId,
        current_period_end: LessThanOrEqual(new Date()),
        status: SubscriptionStatus.ACTIVE,
      },
      {
        status: SubscriptionStatus.RENEWING,
      },
    );

    return result.affected === 1;
  }

  public getWillBeChargedSubscriptions() {
    const now = new Date();

    return this.subscriptionRepository.find({
      where: {
        current_period_end: And(
          MoreThan(now),
          LessThanOrEqual(add(now, { days: 3 })),
        ),
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['user'],
    });
  }

  public async getCurrentSubscriptionForUser(userId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      select: {
        plan: true,
        status: true,
        current_period_end: true,
        six_months: true,
        is_trial: true,
      },
      where: [
        { user_id: userId, status: SubscriptionStatus.ACTIVE },
        {
          user_id: userId,
          status: SubscriptionStatus.CANCELED,
          current_period_end: MoreThan(new Date()),
        },
      ],
    });

    if (!subscription) {
      return null;
    }

    const tariff = await this.tariffService.getTariff(
      subscription.plan,
      userId,
      subscription.six_months,
    );

    return {
      plan: subscription.plan,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      next_payment_amount: tariff.price,
      is_trial: subscription.is_trial,
    };
  }

  public expireSubscription(subscriptionId: string) {
    return this.subscriptionRepository.update(subscriptionId, {
      current_period_start: null,
      current_period_end: null,
      status: SubscriptionStatus.EXPIRED,
      is_trial: false,
    });
  }

  public failSubscription(subscriptionId: string) {
    return this.subscriptionRepository.update(subscriptionId, {
      current_period_start: null,
      current_period_end: null,
      status: SubscriptionStatus.FAILED,
      is_trial: false,
    });
  }

  public cancelSubscription(userId: string) {
    return this.subscriptionRepository.update(
      {
        user_id: userId,
        status: SubscriptionStatus.ACTIVE,
      },
      {
        status: SubscriptionStatus.CANCELED,
      },
    );
  }

  public async resumeSubscription(userId: string): Promise<void> {
    const criteria = {
      user_id: userId,
      status: SubscriptionStatus.CANCELED,
      current_period_end: MoreThan(new Date()),
    };
    const result = await this.subscriptionRepository.update(
      [
        { ...criteria, rebill_id: MoreThan(0) },
        { ...criteria, account_token: Not('') },
      ],
      { status: SubscriptionStatus.ACTIVE },
    );

    if (result.affected !== 1) {
      throw new ConflictException(
        'Subscription must be canceled, unexpired, and have a linked payment method',
      );
    }
  }
}
