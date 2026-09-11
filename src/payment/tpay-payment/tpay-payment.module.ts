import { Module } from '@nestjs/common';
import { TpayPaymentService } from './tpay-payment.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { TariffModule } from 'src/tariff/tariff.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
  imports: [
    TariffModule,
    SubscriptionModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  providers: [TpayPaymentService, TinkoffKassaService],
  exports: [TpayPaymentService],
})
export class TpayPaymentModule {}
