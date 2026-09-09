import { Module } from '@nestjs/common';
import { SbpModule } from 'src/payment/sbp/sbp.module';
import { TpayModule } from 'src/payment/tpay/tpay.module';
import { UserModule } from 'src/user/user.module';
import { SubscriptionModule } from '../subscription.module';
import { SubscriptionCheckService } from './subscription-check.service';

@Module({
  imports: [SubscriptionModule, UserModule, TpayModule, SbpModule],
  providers: [SubscriptionCheckService],
})
export class SubscriptionCheckModule {}
