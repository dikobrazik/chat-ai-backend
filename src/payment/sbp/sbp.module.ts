import { Module } from '@nestjs/common';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { SbpService } from './sbp.service';
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
  providers: [SbpService, TinkoffKassaService],
  exports: [SbpService],
})
export class SbpModule {}
