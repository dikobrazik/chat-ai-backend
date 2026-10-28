import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { TariffInfoDto } from './dto';
import { SbpPaymentService } from './sbp-payment/sbp-payment.service';
import { TpayPaymentService } from './tpay-payment/tpay-payment.service';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  @Inject(SbpPaymentService)
  private readonly sbpPaymentService: SbpPaymentService;
  @Inject(TpayPaymentService)
  private readonly tpayPaymentService: TpayPaymentService;
  @Inject(PaymentService)
  private readonly paymentService: PaymentService;

  @Delete('method')
  public async removeMethod(@User() user: UserEntity): Promise<void> {
    await this.paymentService.removeMethod(user.id);
  }

  @Get('history')
  public getHistory(@User() user: UserEntity) {
    return this.paymentService.getHistory(user.id);
  }

  @Get('method')
  public async getMethod(@User() user: UserEntity, @Res() response: Response) {
    return response.json(await this.paymentService.getMethod(user.id));
  }

  // перепривязать метод оплаты (сменить сбп)
  @Post('method/generate-qr')
  public generatePaymentMethodQr(@User() user: UserEntity) {
    return this.sbpPaymentService.getPaymentMethodQr(user);
  }

  @Post('generate-qr')
  public async generateSbpQr(
    @Body() body: TariffInfoDto,
    @User() user: UserEntity,
  ) {
    return this.sbpPaymentService.getAddAccountQr(body, user);
  }

  @Post('get-tpay-link')
  public async createTPayLink(
    @Req() req: Request,
    @Body() body: TariffInfoDto,
    @User() user: UserEntity,
  ) {
    return this.tpayPaymentService.getTPayLink(body, user, req);
  }
}
