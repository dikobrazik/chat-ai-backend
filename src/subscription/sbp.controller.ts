import { Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { Request } from 'express';
import { prepareDeviceInfo } from './tinkoff-kassa/utils';
import { LinkSbpAccountDto } from './dto';

@Controller('subscription/sbp')
export class SubscriptionSbpController {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;
  @Inject(TinkoffKassaService)
  private readonly tinkoffKassaService: TinkoffKassaService;

  @Get('banks')
  public sbpBanksList(@Req() req: Request) {
    const deviceInfo = prepareDeviceInfo({
      type: req.clientInfo.device.type,
      os: req.clientInfo.os.name,
    });
    return this.tinkoffKassaService
      .getSbpBanksList(deviceInfo.deviceType, deviceInfo.deviceOs)
      .then((r) => r.BankList);
  }

  @Post(':bankId/link')
  public sbpBanksLink(@Param() params: LinkSbpAccountDto) {
    return this.tinkoffKassaService
      .addSbpAccount(params.bankId)
      .then((r) => r.Data.Payload);
  }
}
