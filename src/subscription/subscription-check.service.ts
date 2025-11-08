import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { PLAN_PRICE } from './constants';
import { User, UserStatus } from 'src/entities/User';

@Injectable()
export class SubscriptionCheckService {
  @Inject(TinkoffKassaService)
  private readonly kassaService: TinkoffKassaService;

  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @Cron(CronExpression.EVERY_HOUR) // Каждый час
  async handleSubscriptionCheck() {
    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {
        current_period_end: LessThanOrEqual(new Date()),
        status: SubscriptionStatus.ACTIVE,
      },
    });

    await Promise.all(
      expiredSubscriptions.map(async (subscription) => {
        if (subscription.rebillId) {
          const amount = PLAN_PRICE[subscription.plan] * 100;

          const {
            identifiers: [{ id: orderId }],
          } = await this.paymentRepository.insert({
            user_id: subscription.user_id,
            amount,
            status: PaymentStatus.NEW,
            subscription_id: subscription.id,
          });

          const paymentResponse = await this.kassaService.initPayment(
            orderId,
            amount,
            subscription.user_id,
          );

          const rebillResponse = await this.kassaService.rebill(
            paymentResponse.PaymentId,
            subscription.rebillId,
          );

          console.log(paymentResponse, rebillResponse);

          // if (rebillResponse.Success) {
          //   const newPeriodEnd = new Date();
          //   newPeriodEnd.setMonth(new Date().getMonth() + 1);

          //   await this.subscriptionRepository.update(subscription.id, {
          //     current_period_start: new Date(),
          //     current_period_end: newPeriodEnd,
          //   });
          // } else {
          //   await this.subscriptionRepository.update(subscription.id, {
          //     status: SubscriptionStatus.EXPIRED,
          //   });
          // }
        } else {
          await this.subscriptionRepository.update(subscription.id, {
            status: SubscriptionStatus.EXPIRED,
          });
          await this.userRepository.update(subscription.user_id, {
            status: UserStatus.ACTIVE,
          });
        }
      }),
    );
  }

  // меняем статус у пользователей, которые отменили подписку
  @Cron(CronExpression.EVERY_HOUR) // Каждый час
  async handleCanceledSubscriptionCheck() {
    const canceledExpiredSubscriptions = await this.subscriptionRepository.find(
      {
        where: {
          current_period_end: LessThanOrEqual(new Date()),
          status: SubscriptionStatus.CANCELED,
        },
      },
    );

    await Promise.all(
      canceledExpiredSubscriptions.map((subscription) =>
        this.userRepository.update(subscription.user_id, {
          status: UserStatus.ACTIVE,
          active_subscription_id: null,
        }),
      ),
    );
  }
}
