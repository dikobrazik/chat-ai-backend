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
import { PromotionService } from 'src/promotion/promotion.service';
import { FIRST_SUBSCRIPTION_PROMOTION_ID } from 'src/promotion/constants';
import { TariffService } from 'src/tariff/tariff.service';

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
  @Inject(PromotionService)
  private promotionService: PromotionService;
  @Inject(TariffService)
  private tariffService: TariffService;

  public async processNotification(
    notification: KassaNotification | AddAccountQrNotification,
  ) {
    const isTokenValid = this.kassaService.checkToken(notification);

    if (isTokenValid) {
      const { Status, Success } = notification;

      // TODO: проверить отношение Success и status
      console.log(notification);

      if (!Success) {
        if ('OrderId' in notification) {
          await this.rejectPayment(notification.OrderId);
        }
      } else if (Status === PAYMENT_NOTIFICATION_STATUSES.REJECTED) {
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

    const tariff = await this.tariffService.getTariff(
      payment.subscription.plan,
      payment.user_id,
      // todo: надо понимать на сколько месяцев была куплена подписка, чтобы правильно посчитать nextChargeAt
      // докинуть в Subscription поле, которое будет хранить на сколько месяцев куплена подписка
      false,
    );

    if (!payment) {
      console.error(`Payment with orderId ${orderId} not found`, notification);
      throw new BadRequestException('Payment not found');
    }

    await Promise.all([
      // todo: проверять, что промо использовано ранее
      this.promotionService.markPromotionAsUsed(
        FIRST_SUBSCRIPTION_PROMOTION_ID,
        payment.user_id,
      ),
      this.paymentRepository.update(payment.id, {
        status: PaymentStatus.CONFIRMED,
        payment_date: new Date(),
      }),
      this.subscriptionRepository.update(payment.subscription_id, {
        status: SubscriptionStatus.ACTIVE,
        rebill_id: notification.RebillId,
        current_period_start: new Date(),
        current_period_end: tariff.nextChargeAt,
      }),
      this.userRepository.update(payment.user_id, {
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
