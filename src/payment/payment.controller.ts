import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { InitSubscriptionDto } from './dto';
import { SbpPaymentService } from './sbp-payment/sbp-payment.service';
import { TpayPaymentService } from './tpay-payment/tpay-payment.service';

@Controller('payment')
export class PaymentController {
  @Inject(SbpPaymentService)
  private readonly sbpPaymentService: SbpPaymentService;
  @Inject(TpayPaymentService)
  private readonly tpayPaymentService: TpayPaymentService;

  @Post('generate-qr')
  public async generateSbpQr(
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.sbpPaymentService.getAddAccountQr(body, user);
  }

  @Post('tpay-link')
  public async createTPayLink(
    @Req() req: Request,
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.tpayPaymentService.getTPayLink(body, user, req);
  }
}
