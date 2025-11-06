import { Inject, Injectable } from '@nestjs/common';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../entities/Subscription';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/Payment';
import { PLAN_PRICE } from './constants';

@Injectable()
export class SubscriptionService {
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;

  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;

  public async initPayment(plan: SubscriptionPlan, userId: string) {
    const planPrice = PLAN_PRICE[plan] * 100;

    const {
      identifiers: [{ id: subscriptionId }],
    } = await this.subscriptionRepository.insert({
      user_id: userId,
      status: SubscriptionStatus.PENDING,
      plan,
    });
    const {
      identifiers: [{ id: orderId }],
    } = await this.paymentRepository.insert({
      user_id: userId,
      amount: PLAN_PRICE[plan] * 100,
      status: PaymentStatus.NEW,
      subscription_id: subscriptionId,
    });

    const paymentResponse = await this.tinkoffKassaService.initPayment(
      orderId,
      planPrice,
    );

    await this.paymentRepository.update(orderId, {
      paymentId: paymentResponse.PaymentId,
    });

    return paymentResponse;
  }
}
