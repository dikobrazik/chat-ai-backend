import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Promotion } from 'src/entities/Promotion';
import { UserPromotion, UserPromotionStatus } from 'src/entities/UserPromotion';
import { Repository } from 'typeorm';
import {
  FIRST_SUBSCRIPTION_PROMOTION_ID,
  SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
} from './constants';

@Injectable()
export class PromotionService {
  @InjectRepository(Promotion)
  private readonly promotionRepository: Repository<Promotion>;
  @InjectRepository(UserPromotion)
  private readonly userPromotionRepository: Repository<UserPromotion>;

  async markPromotionAsUsed(userPromotionId: string): Promise<void> {
    await this.userPromotionRepository.update(
      { id: userPromotionId },
      { status: UserPromotionStatus.CONSUMED },
    );
  }

  async getFirstSubscriptionPromotion(userId: string) {
    const [userFirstSubscriptionPromotion, promotion] = await Promise.all([
      this.userPromotionRepository.findOne({
        where: {
          promotion_id: FIRST_SUBSCRIPTION_PROMOTION_ID,
          user_id: userId,
        },
      }),
      this.promotionRepository.findOne({
        where: {
          id: FIRST_SUBSCRIPTION_PROMOTION_ID,
        },
      }),
    ]);

    return userFirstSubscriptionPromotion?.status ===
      UserPromotionStatus.EXPIRED
      ? null
      : {
          freeDays: promotion.reward_value,
        };
  }

  async getSixMonthsSubscriptionPromotion() {
    const sixMonthsSubscriptionPromotion =
      await this.promotionRepository.findOne({
        where: {
          id: SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
        },
      });

    return {
      discount: sixMonthsSubscriptionPromotion.reward_value,
    };
  }
}
