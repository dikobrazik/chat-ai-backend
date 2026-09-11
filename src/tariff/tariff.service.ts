import { Inject, Injectable } from '@nestjs/common';
import { PromotionService } from 'src/promotion/promotion.service';
import { TARIFFS } from './constants/tariffs';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { add } from 'date-fns/add';

@Injectable()
export class TariffService {
  @Inject(PromotionService)
  private readonly promotionService: PromotionService;

  public async getUserTariffs(userId: string, sixMonths: boolean = false) {
    const plans = structuredClone(TARIFFS);

    const firstSubscriptionPromotion =
      await this.promotionService.getFirstSubscriptionPromotion(userId);

    const sixMonthPromotion =
      await this.promotionService.getSixMonthsSubscriptionPromotion();

    for (const plan of plans) {
      plan.nextChargeAt = add(new Date(), {
        months: sixMonths ? 6 : 1,
      });
    }

    if (firstSubscriptionPromotion && !sixMonths) {
      plans[1].nextChargeAt = add(new Date(), {
        days: firstSubscriptionPromotion.freeDays,
      });
      plans[1].freeDays = firstSubscriptionPromotion.freeDays;
    }

    if (sixMonthPromotion) {
      plans[1].discount = sixMonthPromotion.discount;
      plans[2].discount = sixMonthPromotion.discount;
    }

    return plans;
  }

  public async getTariff(
    tariffId: SubscriptionPlan,
    userId: string,
    sixMonths: boolean,
  ) {
    const tariffs = await this.getUserTariffs(userId, sixMonths);

    const tariff = tariffs.find((tariff) => tariff.id === tariffId);

    return { ...tariff, price: this.getTariffFinalPrice(tariff, sixMonths) };
  }

  private getTariffFinalPrice(
    tariff: { freeDays?: number; price: number; discount?: number },
    sixMonths: boolean,
  ) {
    const price = tariff.price;
    const discountPrice = tariff.discount ? (price * tariff.discount) / 100 : 0;

    return (price - discountPrice) * 100 * (sixMonths ? 6 : 1);
  }
}
