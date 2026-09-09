import { TestBed, type Mocked } from '@suites/unit';
import { TariffService } from '../tariff.service';
import { PromotionService } from 'src/promotion/promotion.service';

describe(TariffService.name, () => {
  let tariffService: TariffService;
  let promotionServiceMock: Mocked<PromotionService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(TariffService)
      .mock(PromotionService)
      .impl(() => ({
        getFirstSubscriptionPromotion: jest.fn(),
        getSixMonthsSubscriptionPromotion: jest.fn(),
      }))
      .compile();

    tariffService = unit;
    promotionServiceMock = unitRef.get(PromotionService);
  });

  describe('getUserTariffs', () => {
    describe('Если у пользователя нет промо-акций', () => {
      it('Должен вернуть тарифы без промо-акций', async () => {
        promotionServiceMock.getFirstSubscriptionPromotion.mockReturnValueOnce(
          undefined,
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockReturnValueOnce(
          undefined,
        );

        const tariffs = await tariffService.getUserTariffs('userId');

        expect(tariffs).toEqual([
          { id: 0, price: 0 },
          { id: 1, price: 10 },
          { id: 2, price: 20 },
        ]);
      });
    });
  });
});
