import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';

@Module({
  providers: [SubscriptionService, TinkoffKassaService],
  controllers: [SubscriptionController],
})
export class SubscriptionModule {}
