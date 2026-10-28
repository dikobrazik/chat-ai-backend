import { SubscriptionPlan } from 'src/entities/Subscription';
import { type Tariff } from 'src/tariff/types';
import { PaymentAmountService, PaymentMethod } from '../payment-amount.service';

const trialTariff: Tariff = {
  id: SubscriptionPlan.PLUS,
  name: 'Плюс',
  price: 1_000,
  freeDays: 14,
  description: 'Тариф с пробным периодом',
  features: [],
};

describe(PaymentAmountService.name, () => {
  const paymentAmountService = new PaymentAmountService();

  it.each([
    [1_000, PaymentMethod.SBP],
    [1_000, PaymentMethod.TPAY],
    [1_000, PaymentMethod.TBANK],
  ])(
    'Должен рассчитать сумму %i копеек за пробный период при оплате через %s',
    (expectedAmount: number, method: PaymentMethod) => {
      expect(paymentAmountService.getAmount(trialTariff, method)).toBe(
        expectedAmount,
      );
    },
  );

  it.each(Object.values(PaymentMethod))(
    'Должен возвращать стоимость тарифа без пробного периода через %s',
    (method) => {
      expect(
        paymentAmountService.getAmount(
          { ...trialTariff, freeDays: 0, price: 2_000 },
          method,
        ),
      ).toBe(2_000);
    },
  );
});
