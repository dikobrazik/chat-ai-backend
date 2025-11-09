import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../entities/Subscription';
import { Payment } from '../entities/Payment';
import { SubscriptionPaymentNotificationService } from './subscription-payment-notification.service';
import { User } from 'src/entities/User';
import { SubscriptionCheckService } from './subscription-check.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Payment, User])],
  providers: [
    SubscriptionService,
    SubscriptionPaymentNotificationService,
    TinkoffKassaService,
    SubscriptionCheckService,
  ],
  controllers: [SubscriptionController],
})
export class SubscriptionModule {}
