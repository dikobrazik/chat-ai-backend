import { PromotionRewardType, PromotionType } from 'src/entities/Promotion';
import {
  FIRST_SUBSCRIPTION_PROMOTION_ID,
  SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
} from 'src/promotion/constants';

export const SEED_PROMOTIONS = [
  {
    id: FIRST_SUBSCRIPTION_PROMOTION_ID,
    name: 'Первая подписка',
    type: PromotionType.NEW_USER,
    reward_type: PromotionRewardType.FREE_DAYS,
    reward_value: 3,
    max_usages_per_user: 1,
  },
  {
    id: SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
    name: 'Подписка на шесть месяцев',
    type: PromotionType.MANUAL,
    reward_type: PromotionRewardType.PERCENT_DISCOUNT,
    reward_value: 10,
    max_usages_per_user: null,
  },
];
