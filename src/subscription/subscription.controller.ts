import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { PLANS } from './constants';
import { SubscriptionService } from './subscription.service';
import { InitSubscriptionDto } from './dto';
import { User } from '../decorators/user.decorator';
import { User as UserEntity } from '../entities/User';
import { KassaNotification } from './tinkoff-kassa/types';
import { Response } from 'express';
import { SubscriptionPaymentNotificationService } from './subscription-payment-notification.service';

@Controller('subscription')
export class SubscriptionController {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;
  @Inject(SubscriptionPaymentNotificationService)
  private readonly subscriptionPaymentNotificationService: SubscriptionPaymentNotificationService;

  @Get('plans')
  public getPlans() {
    return PLANS;
  }

  @Post('init')
  public initSubscription(
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.subscriptionService
      .initPayment(body.plan, user.id)
      .then((r) => ({ PaymentURL: r.PaymentURL }));
  }

  @Post('cancel')
  public cancelSubscription(@User() user: UserEntity) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  @Get()
  public getActiveSubscription(@User() user: UserEntity) {
    return this.subscriptionService.getSubscription(
      user.active_subscription_id,
    );
  }

  @Post('/notify')
  async notification(
    @Body() body: KassaNotification,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.statusCode = HttpStatus.OK;

    await this.subscriptionPaymentNotificationService.processNotification(body);

    return 'OK';
  }
}
