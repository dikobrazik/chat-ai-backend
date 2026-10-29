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
      .impl(() => ({ findOne: jest.fn(), update: jest.fn() }))
      .compile();
    service = unit;
    repository = unitRef.get(repositoryToken);
    subscriptionRepository = unitRef.get(subscriptionRepositoryToken);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('removeMethod', () => {
    const now = new Date('2026-10-28T13:05:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([0, 1])(
      'Должен очищать только реквизиты текущего пользователя независимо от наличия подписки (%s)',
      async (affected) => {
        subscriptionRepository.update.mockResolvedValueOnce({
          affected,
          raw: [],
          generatedMaps: [],
        });

        await expect(service.removeMethod('user-id')).resolves.toBeUndefined();
        expect(subscriptionRepository.update).toHaveBeenCalledWith(
          { user_id: 'user-id' },
          {
            rebill_id: null,
            account_token: null,
            pan: null,
            payment_method_link_request_key: null,
            payment_method_deleted_at: now,
          },
        );
        expect(subscriptionRepository.findOne).not.toHaveBeenCalled();
      },
    );

    it('Должен обновлять время удаления при повторном запросе', async () => {
      await service.removeMethod('user-id');
      jest.advanceTimersByTime(60_000);
      await service.removeMethod('user-id');

      expect(subscriptionRepository.update).toHaveBeenLastCalledWith(
        { user_id: 'user-id' },
        expect.objectContaining({
          payment_method_deleted_at: new Date(now.getTime() + 60_000),
        }),
      );
    });

    it('Должен пробрасывать ошибку базы данных без успешного ответа', async () => {
      const error = new Error('Database unavailable');
      subscriptionRepository.update.mockRejectedValueOnce(error);

      await expect(service.removeMethod('user-id')).rejects.toBe(error);
    });
  });

  describe('getMethod', () => {
    it('Должен искать только реквизиты текущего пользователя и возвращать null без подписки', async () => {
      subscriptionRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getMethod('user-id')).resolves.toBeNull();
      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        select: {
          rebill_id: true,
          account_token: true,
          pan: true,
        },
        where: { user_id: 'user-id' },
      });
    });

    it.each([
      {
        rebill_id: 123,
        account_token: null,
        pan: '430000******0777',
        expected: { type: PaymentMethod.TPAY, description: '430000******0777' },
      },
      {
        rebill_id: null,
        account_token: 'private-token',
        pan: '+7(900)***-**-12',
        expected: { type: PaymentMethod.SBP, description: '+7(900)***-**-12' },
      },
      {
        rebill_id: 123,
        account_token: 'private-token',
        pan: '**** 0777',
        expected: { type: PaymentMethod.TPAY, description: '**** 0777' },
      },
      {
        rebill_id: 123,
        account_token: null,
        pan: null,
        expected: { type: PaymentMethod.TPAY, description: null },
      },
      {
        rebill_id: null,
        account_token: 'private-token',
        pan: null,
        expected: { type: PaymentMethod.SBP, description: null },
      },
      {
        rebill_id: 0,
        account_token: '',
        pan: '**** 0777',
        expected: null,
      },
      {
        rebill_id: -1,
        account_token: null,
        pan: null,
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
