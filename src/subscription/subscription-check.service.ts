import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { LessThanOrEqual, Repository } from 'typeorm';
import { SubscriptionService } from './subscription.service';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';

@Injectable()
export class SubscriptionCheckService {
  @Inject(TinkoffKassaService)
  private readonly kassaService: TinkoffKassaService;
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @Cron(CronExpression.EVERY_DAY_AT_NOON) // Каждый день в обед
  async handleSubscriptionCheck() {
    const expiredSubscriptions = await this.subscriptionRepository.find({
      where: {
        current_period_end: LessThanOrEqual(new Date()),
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['user'],
    });

    await Promise.all(
      expiredSubscriptions.map(async (subscription) => {
        const isSixMonths =
          subscription.current_period_end.getTime() -
            subscription.current_period_start.getTime() >=
          6 * 30 * 24 * 60 * 60 * 1000;

        console.log(subscription, isSixMonths);

        if (subscription.rebill_id) {
          try {
            const amount = await this.subscriptionService.getPlanPrice(
              subscription.user_id,
              subscription.plan,
              isSixMonths,
            );

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
              subscription.user.email,
            );

            await this.kassaService.charge(
              paymentResponse.PaymentId,
              subscription.rebill_id,
              subscription.user.email,
            );
          } catch (error) {
            console.error(
              `Failed to charge subscription for user ${subscription.user_id}:`,
              error,
            );
          }
        } else {
          try {
            await Promise.all([
              this.subscriptionRepository.update(subscription.id, {
                status: SubscriptionStatus.EXPIRED,
              }),
              this.userRepository.update(subscription.user_id, {
                status: UserStatus.ACTIVE,
                active_subscription_id: null,
              }),
            ]);
          } catch (error) {
            console.error(
              `Failed to update subscription or user for subscription ${subscription.id}:`,
              error,
            );
          }
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

    await Promise.allSettled(
      canceledExpiredSubscriptions.map((subscription) =>
        this.userRepository.update(subscription.user_id, {
          status: UserStatus.ACTIVE,
          active_subscription_id: null,
        }),
      ),
    );
  }
}
