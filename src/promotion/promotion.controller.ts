import { Controller, Get, Inject } from '@nestjs/common';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { PromotionService } from './promotion.service';

@Controller('promotion')
export class PromotionController {
  @Inject(PromotionService)
  private readonly promotionService: PromotionService;

  @Get('first-subscription')
  async getFirstSubscriptionPromotion(@User() user: UserEntity) {
    return this.promotionService.getFirstSubscriptionPromotion(user.id);
  }

  @Get('six-months-subscription')
  async getSixMonthsSubscriptionPromotion() {
    return this.promotionService.getSixMonthsSubscriptionPromotion();
  }
}
