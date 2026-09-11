import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { TariffService } from 'src/tariff/tariff.service';
import { Repository } from 'typeorm';

export abstract class BasePaymentService {
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;

  @Inject(TariffService)
  private readonly tariffService: TariffService;

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
}
