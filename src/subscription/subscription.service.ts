import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { PromotionService } from 'src/promotion/promotion.service';
import { Repository } from 'typeorm';
import { PLANS } from './constants';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { addDays, addMonths } from 'date-fns';

@Injectable()
export class SubscriptionService {
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;
  @Inject(PromotionService)
  private readonly promotionService: PromotionService;

  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;

  public async initPayment(
    planId: SubscriptionPlan,
    sixMonths: boolean,
    userId: string,
    userEmail: string,
  ) {
    const amount = await this.getPlanPrice(userId, planId, sixMonths);
    const plan = (await this.getUserPlans(userId)).find((p) => p.id === planId);

    let currentPeriodEnd = new Date();

    if (sixMonths) {
      currentPeriodEnd = addMonths(currentPeriodEnd, 6);
    } else {
      if (plan.freeDays) {
        currentPeriodEnd = addDays(currentPeriodEnd, plan.freeDays ?? 0);
      } else {
        currentPeriodEnd = addMonths(currentPeriodEnd, 1);
      }
    }

    const {
      identifiers: [{ id: subscriptionId }],
    } = await this.subscriptionRepository.insert({
      user_id: userId,
      status: SubscriptionStatus.PENDING,
      plan: planId,
      current_period_start: new Date(),
      current_period_end: currentPeriodEnd,
    });
    const {
      identifiers: [{ id: orderId }],
    } = await this.paymentRepository.insert({
      user_id: userId,
      amount,
      status: PaymentStatus.NEW,
      subscription_id: subscriptionId,
    });

    const paymentResponse = await this.tinkoffKassaService.initPayment(
      orderId,
      amount,
      userId,
      userEmail,
    );

    await this.paymentRepository.update(orderId, {
      payment_id: paymentResponse.PaymentId,
    });

    return paymentResponse;
  }

  public getSubscription(subscriptionId: string) {
    return this.subscriptionRepository
      .findOne({
        where: { id: subscriptionId },
      })
      .then(({ rebill_id, ...subscription }) => ({ subscription }));
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

  public async getUserPlans(userId: string, sixMonths: boolean = false) {
    const plans = structuredClone(PLANS);

    const firstSubscriptionPromotion =
      await this.promotionService.getFirstSubscriptionPromotion(userId);

    const sixMonthPromotion =
      await this.promotionService.getSixMonthsSubscriptionPromotion();

    if (firstSubscriptionPromotion && !sixMonths) {
      plans[1].freeDays = firstSubscriptionPromotion.freeDays;
    }

    if (sixMonthPromotion) {
      plans[1].discount = sixMonthPromotion.discount;
      plans[2].discount = sixMonthPromotion.discount;
    }

    return plans;
  }

  public async getPlanPrice(
    userId: string,
    planId: SubscriptionPlan,
    sixMonths: boolean,
  ) {
    const plans = await this.getUserPlans(userId, sixMonths);

    const plan = plans.find((plan) => plan.id === planId);

    const price = plan.freeDays ? 1 : plan.price;

    const discountPrice =
      plan.discount && price !== 1 ? (price * plan.discount) / 100 : 0;

    return (price - discountPrice) * 100 * (sixMonths ? 6 : 1);
  }
}
