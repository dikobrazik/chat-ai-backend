import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { TariffInfoDto } from '../dto';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';

import { User as UserEntity } from 'src/entities/User';
import { AddAccountQrNotification } from 'src/payment/webhook/types';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { BasePaymentService } from '../base-payment.service';
import { Subscription } from 'src/entities/Subscription';
import { CachedRequestParams } from './types';

@Injectable()
export class SbpPaymentService extends BasePaymentService {
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @Inject(CACHE_MANAGER)
  private cacheManager: Cache;

  public async getAddAccountQr(body: TariffInfoDto, user: UserEntity) {
    const response = await this.tinkoffKassaService.addAccountQr();

    await this.cacheManager.set<CachedRequestParams>(
      response.RequestKey,
      {
        sixMonths: body.sixMonths,
        tariffId: body.tariff,
        userId: user.id,
        userEmail: user.email,
      },
      30 * 60 * 1000,
    );

    return { svg: response.Data };
  }

  public async onAccountLinked(notification: AddAccountQrNotification) {
    const { RequestKey, AccountToken } = notification;

    const { tariffId, sixMonths, userId, userEmail } =
      await this.cacheManager.get<CachedRequestParams>(RequestKey);

    const { subscriptionId } =
      await this.subscriptionService.createSubscription(
        tariffId,
        userId,
        sixMonths,
      );

    const { paymentId, amount } = await this.createPayment(
      subscriptionId,
      tariffId,
      userId,
      sixMonths,
    );

    const { PaymentId: externalPaymentId } =
      await this.tinkoffKassaService.createPayment({
        OrderId: paymentId,
        Amount: amount,
        CustomerKey: userId,
        Email: userEmail,
        DATA: { QR: 'true', OperationInitiatorType: 'R' },
      });

    await Promise.all([
      this.linkExternalPayment(paymentId, externalPaymentId),
      this.subscriptionService.updateAccountToken(subscriptionId, AccountToken),
      this.tinkoffKassaService.chargeQr(externalPaymentId, AccountToken),
    ]);
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
      DATA: { QR: 'true', OperationInitiatorType: 'R' },
    });

    await this.tinkoffKassaService.chargeQr(
      paymentResponse.PaymentId,
      subscription.account_token,
    );
  }
}
