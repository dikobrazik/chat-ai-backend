import { Module } from '@nestjs/common';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { SbpPaymentService } from './sbp-payment.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { TariffModule } from 'src/tariff/tariff.module';

@Module({
  imports: [
    TariffModule,
    SubscriptionModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  providers: [SbpPaymentService, TinkoffKassaService],
  exports: [SbpPaymentService],
})
export class SbpPaymentModule {}
