import { Module } from '@nestjs/common';
import { SbpPaymentModule } from 'src/payment/sbp-payment/sbp-payment.module';
import { TpayPaymentModule } from 'src/payment/tpay-payment/tpay-payment.module';
import { UserModule } from 'src/user/user.module';
import { SubscriptionModule } from '../subscription.module';
import { SubscriptionCheckService } from './subscription-check.service';
import { MailerModule } from 'src/mailer/mailer.module';
import { SubscriptionNotificationCheckService } from './subscription-notification-check.service';

@Module({
  imports: [
    MailerModule,
    SubscriptionModule,
    UserModule,
    TpayPaymentModule,
    SbpPaymentModule,
  ],
  providers: [SubscriptionCheckService, SubscriptionNotificationCheckService],
})
export class SubscriptionCheckModule {}
