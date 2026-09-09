import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from 'src/entities/Subscription';
import { PromotionModule } from 'src/promotion/promotion.module';
import { TariffModule } from 'src/tariff/tariff.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    PromotionModule,
    TariffModule,
    TypeOrmModule.forFeature([Subscription]),
  ],
  providers: [SubscriptionService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
