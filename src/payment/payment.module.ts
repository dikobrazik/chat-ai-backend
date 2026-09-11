import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { TariffModule } from 'src/tariff/tariff.module';
import { PaymentController } from './payment.controller';
import { SbpPaymentModule } from './sbp-payment/sbp-payment.module';
import { TpayPaymentModule } from './tpay-payment/tpay-payment.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    WebhookModule,
    TpayPaymentModule,
    SbpPaymentModule,
    TariffModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  controllers: [PaymentController],
})
export class PaymentModule {}
