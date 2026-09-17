import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
        this.sendChargeReminder(
          subscription.id,
          subscription.user_id,
          subscription.plan,
          subscription.six_months,
          subscription.rebill_id ? PaymentMethod.TPAY : PaymentMethod.SBP,
          subscription.current_period_end,
          subscription.user.email,
          subscription.user.name,
        ),
      ),
    );
  }

  private async sendChargeReminder(
    subscriptionId: string,
    userId: string,
    plan: Parameters<TariffService['getTariff']>[0],
    sixMonths: boolean,
    paymentMethod: PaymentMethod,
    periodEnd: Date,
    email: string,
    name: string | null,
  ) {
    const claimed =
      await this.subscriptionNotificationService.claimChargeReminder(
        subscriptionId,
        periodEnd,
      );

    if (!claimed) {
      return;
    }

    try {
      const tariff = await this.tariffService.getTariff(
        plan,
        userId,
        sixMonths,
      );
      const amount = this.paymentAmountService.getAmount(tariff, paymentMethod);

      await this.mailerService.sendChargeNotification({
        to: email,
        name,
        plan,
        chargeDate: periodEnd,
        amount,
      });
      await this.subscriptionNotificationService.markChargeReminderSent(
        subscriptionId,
        periodEnd,
      );
    } catch (error) {
      await this.subscriptionNotificationService.markChargeReminderFailed(
        subscriptionId,
        periodEnd,
      );
      throw error;
    }
  }
}
