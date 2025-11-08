import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Repository } from 'typeorm';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { KassaNotification } from './tinkoff-kassa/types';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';

const SUBSCRIPTION_PLAN_USER_STATUS_MAP = {
  [SubscriptionPlan.BASE]: UserStatus.SUBSCRIPTION_BASE,
  [SubscriptionPlan.PLUS]: UserStatus.SUBSCRIPTION_PLUS,
  [SubscriptionPlan.PRO]: UserStatus.SUBSCRIPTION_PRO,
};

@Injectable()
export class SubscriptionPaymentNotificationService {
  @InjectRepository(User)
  private userRepository: Repository<User>;
  @InjectRepository(Payment)
  private paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private subscriptionRepository: Repository<Subscription>;

  @Inject(TinkoffKassaService)
  private kassaService: TinkoffKassaService;

  public async processNotification(notification: KassaNotification) {
    console.log(notification);
    const isTokenValid = this.kassaService.checkToken(notification);

    if (isTokenValid) {
      console.log(notification);
      const orderId = notification.OrderId;
      const payment = await this.paymentRepository.findOne({
        where: { id: orderId },
        relations: { subscription: true },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }
      if (notification.Success) {
        if (notification.Status === 'CONFIRMED') {
          const currentPeriodEnd = new Date();
          // для тестов
          currentPeriodEnd.setDate(new Date().getDate() + 1);
          // currentPeriodEnd.setMonth(new Date().getMonth() + 1);

          await Promise.all([
            this.paymentRepository.update(orderId, {
              status: PaymentStatus.CONFIRMED,
              payment_date: new Date(),
            }),
            this.subscriptionRepository.update(payment.subscription_id, {
              status: SubscriptionStatus.ACTIVE,
              current_period_start: new Date(),
              current_period_end: currentPeriodEnd, // next month same day
              rebillId: notification.RebillId,
            }),
            this.userRepository.update(payment.user_id, {
              active_subscription_id: payment.subscription_id,
              status:
                SUBSCRIPTION_PLAN_USER_STATUS_MAP[payment.subscription.plan],
            }),
          ]);
        }
      } else {
        this.paymentRepository.update(orderId, {
          status: PaymentStatus.REJECTED,
        });
      }
    } else {
      throw new BadRequestException();
    }
  }
}
