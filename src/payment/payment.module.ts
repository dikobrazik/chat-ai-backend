import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SbpModule } from './sbp/sbp.module';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { TpayModule } from './tpay/tpay.module';
import { WebhookModule } from './webhook/webhook.module';
import { TariffModule } from 'src/tariff/tariff.module';

@Module({
  imports: [
    WebhookModule,
    TpayModule,
    SbpModule,
    TariffModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, TinkoffKassaService],
  exports: [PaymentService, TinkoffKassaService],
})
export class PaymentModule {}
