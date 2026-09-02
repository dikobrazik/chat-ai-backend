import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { InitSubscriptionDto } from './dto';
import { SubscriptionPaymentNotificationService } from './subscription-payment-notification.service';
import { SubscriptionService } from './subscription.service';
import { KassaNotification } from './tinkoff-kassa/types';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';

@Controller('subscription')
export class SubscriptionController {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;
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
  public async initSubscription(
    @Req() req: Request,
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.subscriptionService
      .initPayment(
        body.plan,
        body.sixMonths,
        user.id,
        user.email,
        req.clientInfo,
      )
      .then((r) => ({ paymentId: r.PaymentId, paymentURL: r.PaymentURL }));
  }

  @Post('t-pay-link')
  public async createTPayLink(
    @Req() req: Request,
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    const { Params } = await this.tinkoffKassaService.checkTPayLink();

    const { PaymentId } = await this.subscriptionService.initPayment(
      body.plan,
      body.sixMonths,
      user.id,
      user.email,
      req.clientInfo,
    );

    return this.tinkoffKassaService
      .getTPayLink(PaymentId, Params.Version)
      .then((response) => response.Params);
  }

  @Post('cancel')
  public cancelSubscription(@User() user: UserEntity) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  @Get()
  public getActiveSubscription(@User() user: UserEntity) {
    if (!user.active_subscription_id) {
      return null;
    }

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
