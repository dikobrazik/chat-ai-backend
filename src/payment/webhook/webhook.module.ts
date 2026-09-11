import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/entities/User';
import { Subscription } from 'src/entities/Subscription';
import { Payment } from 'src/entities/Payment';
import { SbpPaymentModule } from '../sbp-payment/sbp-payment.module';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Subscription]),
    SbpPaymentModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService, TinkoffKassaService],
  exports: [WebhookService],
})
export class WebhookModule {}
