import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addDays, addMonths } from 'date-fns';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription, SubscriptionPlan } from 'src/entities/Subscription';
import { SubscriptionFactory } from 'src/subscription/subscription.factory';
import { TariffService } from 'src/tariff/tariff.service';
import { Repository } from 'typeorm';

export abstract class BasePaymentService {
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;

  @Inject(TariffService)
  private readonly tariffService: TariffService;

  public async createSubscription(
    tariffId: SubscriptionPlan,
    userId: string,
    sixMonths: boolean,
  ) {
    const tariff = await this.tariffService.getTariff(
      tariffId,
      userId,
      sixMonths,
    );

    const currentPeriodEnd = SubscriptionFactory.getPeriodEnd(
      sixMonths,
      tariff.freeDays,
    );

    const {
      identifiers: [{ id: subscriptionId }],
    } = await this.subscriptionRepository.insert(
      SubscriptionFactory.createSubscription(
        tariffId,
        userId,
        currentPeriodEnd,
      ),
    );

    const { paymentId } = await this.createPayment(
      subscriptionId,
      tariff.id,
      userId,
      sixMonths,
    );

    return { amount: tariff.price, subscriptionId, paymentId };
  }

  public async createPayment(
    subscriptionId: string,
    tariffId: SubscriptionPlan,
    userId: string,
    sixMonths: boolean,
  ) {
    const tariff = await this.tariffService.getTariff(
      tariffId,
      userId,
      sixMonths,
    );

    const {
      identifiers: [{ id: paymentId }],
    } = await this.paymentRepository.insert({
      user_id: userId,
      amount: tariff.price,
      status: PaymentStatus.NEW,
      subscription_id: subscriptionId,
    });

    return { paymentId, amount: tariff.price };
  }

  public async linkExternalPayment(
    paymentId: string,
    externalPaymentId: string,
  ) {
    await this.paymentRepository.update(
      { id: paymentId },
      { external_payment_id: externalPaymentId },
    );
  }

  public static getPeriodEnd(sixMonths: boolean, freeDays: number) {
    let currentPeriodEnd = new Date();

    if (sixMonths) {
      currentPeriodEnd = addMonths(currentPeriodEnd, 6);
    } else {
      if (freeDays) {
        currentPeriodEnd = addDays(currentPeriodEnd, freeDays ?? 0);
      } else {
        currentPeriodEnd = addMonths(currentPeriodEnd, 1);
      }
    }
    return currentPeriodEnd;
  }
}
