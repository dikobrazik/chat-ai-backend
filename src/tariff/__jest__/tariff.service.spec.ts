import { TestBed, type Mocked } from '@suites/unit';
import { PromotionService } from 'src/promotion/promotion.service';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { TARIFFS } from '../constants/tariffs';
import { TariffService } from '../tariff.service';

const CURRENT_DATE = new Date('2026-01-15T12:00:00.000Z');
const MONTHLY_NEXT_CHARGE_DATE = new Date('2026-02-15T12:00:00.000Z');
const SIX_MONTHS_NEXT_CHARGE_DATE = new Date('2026-07-15T12:00:00.000Z');

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

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(CURRENT_DATE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getUserTariffs', () => {
    describe('Если у пользователя нет промо-акций', () => {
      it('Должен вернуть тарифы без промо-акций', async () => {
        promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );

        const tariffs = await tariffService.getUserTariffs('userId');

        expect(tariffs).toEqual(
          TARIFFS.map((tariff) => ({
            ...tariff,
            nextChargeAt: MONTHLY_NEXT_CHARGE_DATE,
          })),
        );
        expect(tariffs).not.toBe(TARIFFS);
        expect(
          promotionServiceMock.getFirstSubscriptionPromotion,
        ).toHaveBeenCalledWith('userId');
        expect(
          promotionServiceMock.getSixMonthsSubscriptionPromotion,
        ).toHaveBeenCalledWith();
      });

      it('Должен назначать списание на последний день следующего месяца для подписки, оформленной 31 числа', async () => {
        jest.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
        promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );

        const tariffs = await tariffService.getUserTariffs('userId');

        expect(tariffs).toMatchObject([
          {
            id: SubscriptionPlan.BASE,
            nextChargeAt: new Date('2026-04-30T12:00:00.000Z'),
          },
          {
            id: SubscriptionPlan.PLUS,
            nextChargeAt: new Date('2026-04-30T12:00:00.000Z'),
          },
          {
            id: SubscriptionPlan.PRO,
            nextChargeAt: new Date('2026-04-30T12:00:00.000Z'),
          },
        ]);
      });
    });

    describe('Если у пользователя есть промо-акция на первую подписку', () => {
      it('Должен добавить бесплатные дни к месячному тарифу Плюс', async () => {
        promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
          { freeDays: 14 },
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );

        const tariffs = await tariffService.getUserTariffs('userId');

        expect(tariffs[1]).toMatchObject({
          id: SubscriptionPlan.PLUS,
          freeDays: 14,
          nextChargeAt: new Date('2026-01-29T12:00:00.000Z'),
        });
        expect(TARIFFS[1].freeDays).toBe(0);
      });

      it('Не должен добавлять бесплатные дни при оплате за шесть месяцев', async () => {
        promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
          { freeDays: 14 },
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );

        const tariffs = await tariffService.getUserTariffs('userId', true);

        expect(tariffs[1]).toMatchObject({
          id: SubscriptionPlan.PLUS,
          freeDays: 0,
          nextChargeAt: SIX_MONTHS_NEXT_CHARGE_DATE,
        });
      });
    });

    describe('Если доступна скидка на шесть месяцев', () => {
      it('Должен добавить скидку к тарифам Плюс и Про', async () => {
        promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
          undefined,
        );
        promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
          { discount: 20 },
        );

        const tariffs = await tariffService.getUserTariffs('userId', true);

        expect(tariffs).toMatchObject([
          {
            id: SubscriptionPlan.BASE,
            nextChargeAt: SIX_MONTHS_NEXT_CHARGE_DATE,
          },
          {
            id: SubscriptionPlan.PLUS,
            discount: 20,
            nextChargeAt: SIX_MONTHS_NEXT_CHARGE_DATE,
          },
          {
            id: SubscriptionPlan.PRO,
            discount: 20,
            nextChargeAt: SIX_MONTHS_NEXT_CHARGE_DATE,
          },
        ]);
      });
    });
  });

  describe('getTariff', () => {
    it('Должен возвращать стоимость тарифа в копейках', async () => {
      promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
        undefined,
      );
      promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
        undefined,
      );

      const tariff = await tariffService.getTariff(
        SubscriptionPlan.PRO,
        'userId',
        false,
      );

      expect(tariff).toMatchObject({
        id: SubscriptionPlan.PRO,
        price: 2000,
        nextChargeAt: MONTHLY_NEXT_CHARGE_DATE,
      });
    });

    it('Должен учитывать бесплатные дни при расчёте месячной стоимости', async () => {
      promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce({
        freeDays: 14,
      });
      promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
        undefined,
      );

      const tariff = await tariffService.getTariff(
        SubscriptionPlan.PLUS,
        'userId',
        false,
      );

      expect(tariff).toMatchObject({
        id: SubscriptionPlan.PLUS,
        freeDays: 14,
        price: 100,
        nextChargeAt: new Date('2026-01-29T12:00:00.000Z'),
      });
    });

    it('Должен учитывать скидку и период в шесть месяцев при расчёте стоимости', async () => {
      promotionServiceMock.getFirstSubscriptionPromotion.mockResolvedValueOnce(
        undefined,
      );
      promotionServiceMock.getSixMonthsSubscriptionPromotion.mockResolvedValueOnce(
        { discount: 20 },
      );

      const tariff = await tariffService.getTariff(
        SubscriptionPlan.PLUS,
        'userId',
        true,
      );

      expect(tariff).toMatchObject({
        id: SubscriptionPlan.PLUS,
        discount: 20,
        price: 4800,
        nextChargeAt: SIX_MONTHS_NEXT_CHARGE_DATE,
      });
    });
  });
});
