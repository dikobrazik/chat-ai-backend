import { Injectable } from '@nestjs/common';
import { type Tariff } from 'src/tariff/types';

export enum PaymentMethod {
  SBP = 'sbp',
  TPAY = 'tpay',
}

const TRIAL_PAYMENT_AMOUNT = {
  [PaymentMethod.SBP]: 1000,
  [PaymentMethod.TPAY]: 1000,
};

@Injectable()
export class PaymentAmountService {
  public getAmount(tariff: Tariff, method: PaymentMethod) {
    if (tariff.freeDays) {
      return TRIAL_PAYMENT_AMOUNT[method];
    }

    return tariff.price;
  }
}
