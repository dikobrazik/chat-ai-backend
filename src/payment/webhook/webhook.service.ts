import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { Repository } from 'typeorm';
import { SbpPaymentService } from '../sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
} from './constants';
import { AddAccountQrNotification, KassaNotification } from './types';

const SUBSCRIPTION_PLAN_USER_STATUS_MAP = {
  [SubscriptionPlan.PLUS]: UserStatus.SUBSCRIPTION_PLUS,
  [SubscriptionPlan.PRO]: UserStatus.SUBSCRIPTION_PRO,
};

@Injectable()
export class WebhookService {
  @InjectRepository(User)
  private userRepository: Repository<User>;
  @InjectRepository(Payment)
  private paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private subscriptionRepository: Repository<Subscription>;

  @Inject(SbpPaymentService)
  private sbpService: SbpPaymentService;
  @Inject(TinkoffKassaService)
  private kassaService: TinkoffKassaService;

  public async processNotification(
    notification: KassaNotification | AddAccountQrNotification,
  ) {
    const isTokenValid = this.kassaService.checkToken(notification);

    if (isTokenValid) {
      const { Status, Success } = notification;

      // TODO: проверить отношение Success и status
      console.log(notification);

      if (!Success || Status === PAYMENT_NOTIFICATION_STATUSES.REJECTED) {
        await this.rejectPayment((notification as KassaNotification).OrderId);
      } else if (Status === PAYMENT_NOTIFICATION_STATUSES.CONFIRMED) {
        await this.updateSubscriptionAndUserStatus(notification);
      } else if (Status === LINK_ACCOUNT_NOTIFICATION_STATUSES.ACTIVE) {
        await this.sbpService.onAccountLinked(notification);
      }
    } else {
      throw new BadRequestException();
    }
  }

  private async updateSubscriptionAndUserStatus(
    notification: KassaNotification,
  ) {
    const orderId = notification.OrderId;
    const payment = await this.paymentRepository.findOne({
      where: { id: orderId },
      relations: { subscription: true },
    });

    if (!payment) {
      console.error(`Payment with orderId ${orderId} not found`, notification);
      throw new BadRequestException('Payment not found');
    }

    await Promise.all([
      this.paymentRepository.update(payment.id, {
        status: PaymentStatus.CONFIRMED,
        payment_date: new Date(),
      }),
      this.subscriptionRepository.update(payment.subscription_id, {
        status: SubscriptionStatus.ACTIVE,
        rebill_id: notification.RebillId,
      }),
      this.userRepository.update(payment.user_id, {
        active_subscription_id: payment.subscription_id,
        status: SUBSCRIPTION_PLAN_USER_STATUS_MAP[payment.subscription.plan],
      }),
    ]);
  }

  private async rejectPayment(orderId: string) {
    await this.paymentRepository.update(orderId, {
      status: PaymentStatus.REJECTED,
    });
  }
}
