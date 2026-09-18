import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionStatus } from 'src/entities/Subscription';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { UserService } from 'src/user/user.service';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class SubscriptionCheckService {
  @Inject(SbpPaymentService)
  private readonly sbpPaymentService: SbpPaymentService;
  @Inject(TpayPaymentService)
  private readonly tpayPaymentService: TpayPaymentService;

  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @Cron(CronExpression.EVERY_30_MINUTES) // каждые 30 минут
  async handleSubscriptionCheck() {
    const expiredSubscriptions =
      await this.subscriptionService.getExpiredSubscriptions();

    await Promise.allSettled(
      expiredSubscriptions.map(async (subscription) => {
        const claimed = await this.subscriptionService.claimExpiredSubscription(
          subscription.id,
        );

        if (!claimed) {
          return;
        }

        if (subscription.rebill_id) {
          await this.tpayPaymentService
            .charge(subscription, subscription.six_months)
            .catch(() =>
              this.failUserSubscription(subscription.id, subscription.user_id),
            );
        } else if (subscription.account_token) {
          await this.sbpPaymentService
            .charge(subscription, subscription.six_months)
            .catch(() =>
              this.failUserSubscription(subscription.id, subscription.user_id),
            );
        } else {
          await this.resetUserSubscription(
            subscription.id,
            subscription.user_id,
          );
        }
      }),
    );
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

  // если не получилось списать деньги, то подписка должна быть отменена
  private async failUserSubscription(subscriptionId: string, userId: string) {
    await Promise.all([
      this.subscriptionService.expireSubscription(subscriptionId),
      this.userService.resetSubscription(userId),
    ]);
  }

  // если нет токена аккаунта и нет rebill_id, то подписка должна быть отменена
  private async resetUserSubscription(subscriptionId: string, userId: string) {
    await Promise.all([
      this.subscriptionService.expireSubscription(subscriptionId),
      this.userService.resetSubscription(userId),
    ]);
  }
}
