import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { TariffModule } from 'src/tariff/tariff.module';
import { PaymentController } from './payment.controller';
import { SbpPaymentModule } from './sbp-payment/sbp-payment.module';
import { TpayPaymentModule } from './tpay-payment/tpay-payment.module';
import { WebhookModule } from './webhook/webhook.module';
import { PaymentService } from './payment.service';
import { TbankPaymentModule } from './tbank-payment/tbank-payment.module';

@Module({
  imports: [
    WebhookModule,
    TpayPaymentModule,
    TbankPaymentModule,
    SbpPaymentModule,
    TariffModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
