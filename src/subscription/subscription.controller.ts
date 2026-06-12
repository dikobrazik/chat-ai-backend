import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { InitSubscriptionDto } from './dto';
import { SubscriptionPaymentNotificationService } from './subscription-payment-notification.service';
import { SubscriptionService } from './subscription.service';
import { KassaNotification } from './tinkoff-kassa/types';

@Controller('subscription')
export class SubscriptionController {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;
  @Inject(SubscriptionPaymentNotificationService)
  private readonly subscriptionPaymentNotificationService: SubscriptionPaymentNotificationService;

  @Get('plans')
  public async getPlans(
    @User() user: UserEntity,
    @Query('sixMonths') sixMonths: string,
  ) {
    return this.subscriptionService.getUserPlans(user.id, sixMonths === 'true');
  }

  @Post('init')
  public initSubscription(
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.subscriptionService
      .initPayment(body.plan, body.sixMonths, user.id, user.email)
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

  @Public()
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
