import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from 'src/entities/Subscription';
import { PromotionModule } from 'src/promotion/promotion.module';
import { TariffModule } from 'src/tariff/tariff.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionNotification } from 'src/entities/SubscriptionNotification';
import { SubscriptionNotificationService } from './subscription-notification.service';

@Module({
  imports: [
    PromotionModule,
    TariffModule,
    TypeOrmModule.forFeature([Subscription, SubscriptionNotification]),
  ],
  providers: [SubscriptionService, SubscriptionNotificationService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService, SubscriptionNotificationService],
})
export class SubscriptionModule {}
