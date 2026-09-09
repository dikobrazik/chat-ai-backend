import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from 'src/entities/Subscription';
import { SbpService } from 'src/payment/sbp/sbp.service';
import { TpayService } from 'src/payment/tpay/tpay.service';
import { UserService } from 'src/user/user.service';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class SubscriptionCheckService {
  @Inject(SbpService)
  private readonly sbpService: SbpService;
  @Inject(TpayService)
  private readonly tpayService: TpayService;

  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @Cron(CronExpression.EVERY_DAY_AT_NOON) // Каждый день в обед
  async handleSubscriptionCheck() {
    const expiredSubscriptions =
      await this.subscriptionService.getExpiredSubscriptions();

    const result = await Promise.allSettled(
      expiredSubscriptions.map(async (subscription) => {
        const isSixMonths =
          subscription.current_period_end.getTime() -
            subscription.current_period_start.getTime() >=
          6 * 30 * 24 * 60 * 60 * 1000;

        if (subscription.rebill_id) {
          await this.tpayService.charge(subscription, isSixMonths);
        } else if (subscription.account_token) {
          await this.sbpService.charge(subscription, isSixMonths);
        } else {
          await this.resetUserSubscription(
            subscription.id,
            subscription.user_id,
          );
        }
      }),
    );

    console.log('Subscription check result:', result.join('\n'));
  }

  // меняем статус у пользователей, которые отменили подписку
  @Cron(CronExpression.EVERY_HOUR) // Каждый час
  async handleCanceledSubscriptionCheck() {
    const canceledExpiredSubscriptions =
      await this.subscriptionService.getExpiredSubscriptions(
        SubscriptionStatus.CANCELED,
      );

    await Promise.allSettled(
      canceledExpiredSubscriptions.map((subscription) =>
        this.userService.resetSubscription(subscription.user_id),
      ),
    );
  }

  private async resetUserSubscription(subscriptionId: string, userId: string) {
    await Promise.all([
      this.subscriptionService.expireSubscription(subscriptionId),
      this.userService.resetSubscription(userId),
    ]);
  }
}
