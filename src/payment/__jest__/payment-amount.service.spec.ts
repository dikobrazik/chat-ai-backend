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
    [100, PaymentMethod.TPAY],
  ])(
    'Должен рассчитать сумму %i копеек за пробный период при оплате через %s',
    (expectedAmount: number, method: PaymentMethod) => {
      expect(paymentAmountService.getAmount(trialTariff, method)).toBe(
        expectedAmount,
      );
    },
  );

  it('Должен возвращать стоимость тарифа без пробного периода', () => {
    expect(
      paymentAmountService.getAmount(
        { ...trialTariff, freeDays: 0, price: 2_000 },
        PaymentMethod.SBP,
      ),
    ).toBe(2_000);
  });
});
