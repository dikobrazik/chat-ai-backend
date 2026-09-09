import { Module } from '@nestjs/common';
import { TpayService } from './tpay.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { TariffModule } from 'src/tariff/tariff.module';

@Module({
  imports: [TariffModule, TypeOrmModule.forFeature([Payment, Subscription])],
  providers: [TpayService, TinkoffKassaService],
  exports: [TpayService],
})
export class TpayModule {}
