import { Inject, Injectable } from '@nestjs/common';
import { BasePaymentService } from '../base-payment.service';
import { InitSubscriptionDto } from '../dto';
import { User as UserEntity } from 'src/entities/User';
import { Request } from 'express';
import { prepareDeviceInfo } from '../tinkoff-kassa/utils';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { Subscription } from 'src/entities/Subscription';

@Injectable()
export class TpayPaymentService extends BasePaymentService {
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;

  public async getTPayLink(
    body: InitSubscriptionDto,
    user: UserEntity,
    req: Request,
  ) {
    const deviceInfo = prepareDeviceInfo({
      type: req.clientInfo.device.type,
      os: req.clientInfo.os.name,
    });

    const { amount, paymentId } = await this.createSubscription(
      body.tariff,
      user.id,
      body.sixMonths,
    );

    const { Params } = await this.tinkoffKassaService.checkTPayLink();
    const paymentResponse = await this.tinkoffKassaService.createPayment({
      OrderId: paymentId,
      Amount: amount,
      CustomerKey: user.id,
      Email: user.email,
      DATA: {
        TinkoffPayWeb: true,
        Device: deviceInfo.deviceType,
        DeviceOs: deviceInfo.deviceOs,
        DeviceWebView: true,
        OperationInitiatorType: 'R',
      },
    });

    await this.linkExternalPayment(paymentId, paymentResponse.PaymentId);

    return this.tinkoffKassaService
      .getTPayLink(paymentResponse.PaymentId, Params.Version)
      .then((response) => response.Params);
  }

  public async charge(subscription: Subscription, sixMonths: boolean) {
    const { paymentId, amount } = await this.createPayment(
      subscription.id,
      subscription.plan,
      subscription.user_id,
      sixMonths,
    );

    const paymentResponse = await this.tinkoffKassaService.createPayment({
      OrderId: paymentId,
      Amount: amount,
      CustomerKey: subscription.user_id,
      Email: subscription.user.email,
      // DATA: { QR: 'true', OperationInitiatorType: 'R' },
    });

    await this.tinkoffKassaService.charge(
      paymentResponse.PaymentId,
      subscription.rebill_id,
      subscription.user.email,
    );
  }
}
