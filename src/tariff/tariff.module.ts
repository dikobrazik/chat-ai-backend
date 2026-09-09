import { Module } from '@nestjs/common';
import { TariffService } from './tariff.service';
import { TariffController } from './tariff.controller';
import { PromotionModule } from 'src/promotion/promotion.module';

@Module({
  imports: [PromotionModule],
  providers: [TariffService],
  exports: [TariffService],
  controllers: [TariffController],
})
export class TariffModule {}
