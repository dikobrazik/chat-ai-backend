import { Body, Controller, Inject, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { InitSubscriptionDto } from './dto';
import { SbpService } from './sbp/sbp.service';
import { TpayService } from './tpay/tpay.service';

@Controller('payment')
export class PaymentController {
  @Inject(SbpService)
  private readonly sbpService: SbpService;
  @Inject(TpayService)
  private readonly tpayService: TpayService;

  @Post('generate-qr')
  public async generateSbpQr(
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.sbpService.getAddAccountQr(body, user);
  }

  @Post('tpay-link')
  public async createTPayLink(
    @Req() req: Request,
    @Body() body: InitSubscriptionDto,
    @User() user: UserEntity,
  ) {
    return this.tpayService.getTPayLink(body, user, req);
  }
}
