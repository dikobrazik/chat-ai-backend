import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/User';
import { Subscription } from 'src/entities/Subscription';
import { Payment } from 'src/entities/Payment';
import { SbpPaymentModule } from '../sbp-payment/sbp-payment.module';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import { PromotionModule } from 'src/promotion/promotion.module';
import { TariffModule } from 'src/tariff/tariff.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Subscription]),
    SbpPaymentModule,
    PromotionModule,
    TariffModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, TinkoffKassaService],
  exports: [WebhookService],
})
export class WebhookModule {}
