import { BadGatewayException } from '@nestjs/common';
import { TestBed, type Mocked } from '@suites/unit';
import { SubscriptionPlan } from 'src/entities/Subscription';
import { User } from 'src/entities/User';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { PaymentMethod } from '../../payment-amount.service';
import { type InitResponse } from '../../tinkoff-kassa/generated';
import { TinkoffKassaService } from '../../tinkoff-kassa/tinkoff-kassa.service';
import { TbankPaymentService } from '../tbank-payment.service';

describe(TbankPaymentService.name, () => {
  let service: TbankPaymentService;
  let subscriptions: Mocked<SubscriptionService>;
  let kassa: Mocked<TinkoffKassaService>;
  const body = { tariff: SubscriptionPlan.PLUS, sixMonths: true };
  const user = Object.assign(new User(), {
    id: 'user-id',
    email: 'user@example.com',
  });
  const response: InitResponse = {
    TerminalKey: 'terminal-key',
    Amount: 6_000,
    OrderId: 'payment-id',
    Success: true,
    Status: 'NEW',
    PaymentId: 'external-payment-id',
    ErrorCode: '0',
    PaymentURL: 'https://securepay.tinkoff.ru/payment',
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(TbankPaymentService)
      .mock(SubscriptionService)
      .impl(() => ({ createSubscription: jest.fn() }))
      .mock(TinkoffKassaService)
      .impl(() => ({ createPayment: jest.fn() }))
      .compile();
    service = unit;
    subscriptions = unitRef.get(SubscriptionService);
    kassa = unitRef.get(TinkoffKassaService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    subscriptions.createSubscription.mockResolvedValue({
      subscriptionId: 'subscription-id',
    });
    kassa.createPayment.mockResolvedValue(response);
    jest
      .spyOn(service, 'createPayment')
      .mockResolvedValue({ paymentId: 'payment-id', amount: 6_000 });
    jest.spyOn(service, 'linkExternalPayment').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Должен создать родительский платёж, сохранить внешний ID и вернуть только PaymentURL', async () => {
    await expect(service.getTBankLink(body, user)).resolves.toEqual({
      PaymentURL: response.PaymentURL,
    });
    expect(subscriptions.createSubscription).toHaveBeenCalledWith(
      SubscriptionPlan.PLUS,
      user.id,
      true,
    );
    expect(service.createPayment).toHaveBeenCalledWith(
      'subscription-id',
      SubscriptionPlan.PLUS,
      user.id,
      true,
      PaymentMethod.TBANK,
    );
    expect(kassa.createPayment).toHaveBeenCalledWith({
      OrderId: 'payment-id',
      Amount: 6_000,
      CustomerKey: user.id,
      Email: user.email,
      DATA: { OperationInitiatorType: '1' },
    });
    expect(service.linkExternalPayment).toHaveBeenCalledWith(
      'payment-id',
      response.PaymentId,
    );
  });

  it.each([undefined, '', '   '])(
    'Должен явно отклонять отсутствие ссылки (%s), сохранив внешний ID',
    async (PaymentURL) => {
      kassa.createPayment.mockResolvedValueOnce({ ...response, PaymentURL });
      await expect(service.getTBankLink(body, user)).rejects.toThrow(
        BadGatewayException,
      );
      expect(service.linkExternalPayment).toHaveBeenCalledWith(
        'payment-id',
        response.PaymentId,
      );
    },
  );

  it('Должен пробрасывать ошибку банка без успешного ответа', async () => {
    const error = new Error('Bank unavailable');
    kassa.createPayment.mockRejectedValueOnce(error);
    await expect(service.getTBankLink(body, user)).rejects.toBe(error);
    expect(service.linkExternalPayment).not.toHaveBeenCalled();
  });

  it('Не должен возвращать ссылку, если внешний ID не удалось сохранить', async () => {
    const error = new Error('Database unavailable');
    jest.mocked(service.linkExternalPayment).mockRejectedValueOnce(error);
    await expect(service.getTBankLink(body, user)).rejects.toBe(error);
  });

  it('Не должен обращаться в банк, если платёж не удалось создать', async () => {
    jest
      .mocked(service.createPayment)
      .mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.getTBankLink(body, user)).rejects.toThrow(
      'Database unavailable',
    );
    expect(kassa.createPayment).not.toHaveBeenCalled();
  });
});
