import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Subscription } from 'src/entities/Subscription';
import { MailerService } from 'src/mailer/mailer.service';
import {
  PaymentAmountService,
  PaymentMethod,
} from 'src/payment/payment-amount.service';
import { TariffService } from 'src/tariff/tariff.service';
import { SubscriptionNotificationService } from '../subscription-notification.service';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class SubscriptionNotificationCheckService {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @Inject(SubscriptionNotificationService)
  private readonly subscriptionNotificationService: SubscriptionNotificationService;

  @Inject(MailerService)
  private readonly mailerService: MailerService;

  @Inject(TariffService)
  private readonly tariffService: TariffService;

  @Inject(PaymentAmountService)
  private readonly paymentAmountService: PaymentAmountService;

  @Cron(CronExpression.EVERY_HOUR)
  async handleChargeReminderCheck() {
    const subscriptions =
      await this.subscriptionService.getWillBeChargedSubscriptions();

    await Promise.allSettled(
      subscriptions.map((subscription) =>
        this.sendChargeReminder(subscription),
      ),
    );
  }

  private async sendChargeReminder(subscription: Subscription) {
    const claimed =
      await this.subscriptionNotificationService.claimChargeReminder(
        subscription.id,
        subscription.current_period_end,
      );

    if (!claimed) {
      return;
    }

    try {
      const tariff = await this.tariffService.getTariff(
        subscription.plan,
        subscription.user_id,
        subscription.six_months,
      );
      const amount = this.paymentAmountService.getAmount(
        tariff,
        subscription.rebill_id ? PaymentMethod.TPAY : PaymentMethod.SBP,
      );

      await this.mailerService.sendChargeNotification({
        to: subscription.user.email,
        name: subscription.user.name,
        plan: subscription.plan,
        chargeDate: subscription.current_period_end,
        amount,
      });
      await this.subscriptionNotificationService.markChargeReminderSent(
        subscription.id,
        subscription.current_period_end,
      );
    } catch (error) {
      await this.subscriptionNotificationService.markChargeReminderFailed(
        subscription.id,
        subscription.current_period_end,
      );
      throw error;
    }
  }
}
