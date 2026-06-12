import { Module } from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { UserPromotion } from 'src/entities/UserPromotion';
import { Promotion } from 'src/entities/Promotion';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionController } from './promotion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion, UserPromotion])],
  providers: [PromotionService],
  exports: [PromotionService],
  controllers: [PromotionController],
})
export class PromotionModule {}
