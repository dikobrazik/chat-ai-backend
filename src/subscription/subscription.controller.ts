import { Controller, Get, Inject, Post } from '@nestjs/common';
import { plans } from './constants';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';

@Controller('subscription')
export class SubscriptionController {
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;

  @Get('plans')
  public getPlans() {
    return plans;
  }

  @Post('init')
  public initSubscription() {
    return this.tinkoffKassaService
      .initPayment(`subscription_order_${Math.random() * 10_000}`, 1000)
      .then((r) => ({ PaymentURL: r.PaymentURL }));
  }
}
