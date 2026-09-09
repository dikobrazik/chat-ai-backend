import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { LessThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class SubscriptionService {
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;

  public updateAccountToken(subscriptionId: string, accountToken: string) {
    return this.subscriptionRepository.update(subscriptionId, {
      account_token: accountToken,
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

  public expireSubscription(subscriptionId: string) {
    return this.subscriptionRepository.update(subscriptionId, {
      status: SubscriptionStatus.EXPIRED,
    });
  }

  public getSubscription(subscriptionId: string) {
    return this.subscriptionRepository
      .findOne({
        select: { plan: true, status: true, current_period_end: true },
        where: { id: subscriptionId },
      })
      .then(({ rebill_id, ...subscription }) => subscription);
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
}
