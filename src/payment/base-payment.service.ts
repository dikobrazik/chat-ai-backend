import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { TariffService } from 'src/tariff/tariff.service';
import { Repository } from 'typeorm';
import { PaymentAmountService, PaymentMethod } from './payment-amount.service';

export abstract class BasePaymentService {
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;

  @Inject(TariffService)
  private readonly tariffService: TariffService;
  @Inject(PaymentAmountService)
  private readonly paymentAmountService: PaymentAmountService;

  public async createPayment(
    subscriptionId: string,
    tariffId: SubscriptionPlan,
    userId: string,
    sixMonths: boolean,
    paymentMethod: PaymentMethod,
  ) {
    const tariff = await this.tariffService.getTariff(
      tariffId,
      userId,
      sixMonths,
    );
    const amount = this.paymentAmountService.getAmount(tariff, paymentMethod);

    const {
      identifiers: [{ id: paymentId }],
    } = await this.paymentRepository.insert({
      user_id: userId,
      amount,
      status: PaymentStatus.NEW,
      subscription_id: subscriptionId,
    });

    return { paymentId, amount };
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
}
