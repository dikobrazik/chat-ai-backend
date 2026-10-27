import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, type Mocked } from '@suites/unit';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { In, type Repository } from 'typeorm';
import { PaymentService } from '../payment.service';
import { PaymentMethod } from '../payment-amount.service';

describe(PaymentService.name, () => {
  let service: PaymentService;
  let repository: Mocked<Repository<Payment>>;
  let subscriptionRepository: Mocked<Repository<Subscription>>;
  const repositoryToken = getRepositoryToken(Payment) as string;
  const subscriptionRepositoryToken = getRepositoryToken(
    Subscription,
  ) as string;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(PaymentService)
      .mock(repositoryToken)
      .impl(() => ({ find: jest.fn() }))
      .mock(subscriptionRepositoryToken)
      .impl(() => ({ findOne: jest.fn() }))
      .compile();
    service = unit;
    repository = unitRef.get(repositoryToken);
    subscriptionRepository = unitRef.get(subscriptionRepositoryToken);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getMethod', () => {
    it('Должен искать только реквизиты текущего пользователя и возвращать null без подписки', async () => {
      subscriptionRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getMethod('user-id')).resolves.toBeNull();
      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        select: {
          rebill_id: true,
          account_token: true,
          tpay_card_mask: true,
          sbp_bank_name: true,
        },
        where: { user_id: 'user-id' },
      });
    });

    it.each([
      {
        rebill_id: 123,
        account_token: null,
        tpay_card_mask: '**** 0777',
        sbp_bank_name: null,
        expected: { type: PaymentMethod.TPAY, description: '**** 0777' },
      },
      {
        rebill_id: null,
        account_token: 'private-token',
        tpay_card_mask: null,
        sbp_bank_name: 'Тестовый банк',
        expected: { type: PaymentMethod.SBP, description: 'Тестовый банк' },
      },
      {
        rebill_id: 123,
        account_token: 'private-token',
        tpay_card_mask: '**** 0777',
        sbp_bank_name: 'Другой банк',
        expected: { type: PaymentMethod.TPAY, description: '**** 0777' },
      },
      {
        rebill_id: 123,
        account_token: null,
        tpay_card_mask: null,
        sbp_bank_name: null,
        expected: { type: PaymentMethod.TPAY, description: null },
      },
      {
        rebill_id: null,
        account_token: 'private-token',
        tpay_card_mask: null,
        sbp_bank_name: null,
        expected: { type: PaymentMethod.SBP, description: null },
      },
      {
        rebill_id: 0,
        account_token: '',
        tpay_card_mask: '**** 0777',
        sbp_bank_name: 'Удалённый банк',
        expected: null,
      },
      {
        rebill_id: -1,
        account_token: null,
        tpay_card_mask: null,
        sbp_bank_name: null,
        expected: null,
      },
    ])(
      'Должен возвращать только тип и описание для реквизитов $rebill_id / $account_token',
      async ({ expected, ...subscription }) => {
        subscriptionRepository.findOne.mockResolvedValueOnce(
          Object.assign(new Subscription(), subscription),
        );

        await expect(service.getMethod('user-id')).resolves.toEqual(expected);
      },
    );
  });

  it('Должен запрашивать только публичные поля завершённых платежей текущего пользователя', async () => {
    repository.find.mockResolvedValueOnce([]);

    await expect(service.getHistory('user-id')).resolves.toEqual([]);

    expect(repository.find).toHaveBeenCalledWith({
      select: {
        id: true,
        amount: true,
        status: true,
        payment_date: true,
        receipt_url: true,
      },
      where: {
        user_id: 'user-id',
        status: In([
          PaymentStatus.CONFIRMED,
          PaymentStatus.REJECTED,
          PaymentStatus.REFUNDED,
        ]),
      },
      order: {
        payment_date: { direction: 'DESC', nulls: 'LAST' },
        id: 'DESC',
      },
    });
  });

  it('Должен сохранять неизвестные даты и отсутствующие чеки без подстановки значений', async () => {
    const payments = [
      Object.assign(new Payment(), {
        id: 'payment-id',
        amount: 100,
        status: PaymentStatus.REJECTED,
        payment_date: null,
        receipt_url: null,
      }),
    ];
    repository.find.mockResolvedValueOnce(payments);

    await expect(service.getHistory('user-id')).resolves.toEqual(payments);
  });
});
