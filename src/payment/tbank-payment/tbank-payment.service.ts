import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { User as UserEntity } from 'src/entities/User';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { BasePaymentService } from '../base-payment.service';
import { TariffInfoDto } from '../dto';
import { PaymentMethod } from '../payment-amount.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';

@Injectable()
export class TbankPaymentService extends BasePaymentService {
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  public async getTBankLink(
    body: TariffInfoDto,
    user: UserEntity,
  ): Promise<{ PaymentURL: string }> {
    const { subscriptionId } =
      await this.subscriptionService.createSubscription(
        body.tariff,
        user.id,
        body.sixMonths,
      );
    const { paymentId, amount } = await this.createPayment(
      subscriptionId,
      body.tariff,
      user.id,
      body.sixMonths,
      PaymentMethod.TBANK,
    );
    const response = await this.tinkoffKassaService.createPayment({
      OrderId: paymentId,
      Amount: amount,
      CustomerKey: user.id,
      Email: user.email,
      DATA: { OperationInitiatorType: '1' },
    });
    await this.linkExternalPayment(paymentId, response.PaymentId);

    if (
      typeof response.PaymentURL !== 'string' ||
      !response.PaymentURL.trim()
    ) {
      throw new BadGatewayException('T-Bank did not return a payment URL');
    }

    return { PaymentURL: response.PaymentURL };
  }
}
