import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { TariffModule } from 'src/tariff/tariff.module';
import { PaymentAmountModule } from '../payment-amount.module';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { TbankPaymentService } from './tbank-payment.service';

@Module({
  imports: [
    TariffModule,
    PaymentAmountModule,
    SubscriptionModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  providers: [TbankPaymentService, TinkoffKassaService],
  exports: [TbankPaymentService],
})
export class TbankPaymentModule {}
