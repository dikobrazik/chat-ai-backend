import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { TariffService } from 'src/tariff/tariff.service';
import { type Repository } from 'typeorm';
import { SubscriptionService } from '../subscription.service';

const subscriptionRepositoryToken = getRepositoryToken(Subscription) as string;
const NOW = new Date('2026-09-11T08:00:00.000Z');
const NEXT_CHARGE_AT = new Date('2026-10-11T08:00:00.000Z');
const THREE_DAYS_FROM_NOW = new Date('2026-09-14T08:00:00.000Z');

describe(SubscriptionService.name, () => {
  let subscriptionService: SubscriptionService;
  let subscriptionRepositoryMock: Mocked<Repository<Subscription>>;
  let tariffServiceMock: Mocked<TariffService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SubscriptionService)
      .mock(subscriptionRepositoryToken)
      .impl(() => ({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
      }))
      .mock(TariffService)
      .impl(() => ({ getTariff: jest.fn() }))
      .compile();

    subscriptionService = unit;
    subscriptionRepositoryMock = unitRef.get(subscriptionRepositoryToken);
    tariffServiceMock = unitRef.get(TariffService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createSubscription', () => {
    it('Должен создать новую ожидающую подписку для пользователя без подписки', async () => {
      tariffServiceMock.getTariff.mockResolvedValueOnce({
        id: SubscriptionPlan.PLUS,
        price: 1_000,
        nextChargeAt: NEXT_CHARGE_AT,
      } as Awaited<ReturnType<TariffService['getTariff']>>);
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce(null);
      subscriptionRepositoryMock.save.mockResolvedValueOnce({
        id: 'subscription-id',
      } as Subscription);

      await expect(
        subscriptionService.createSubscription(
          SubscriptionPlan.PLUS,
          'user-id',
          false,
        ),
      ).resolves.toEqual({ subscriptionId: 'subscription-id' });

      expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
        SubscriptionPlan.PLUS,
        'user-id',
        false,
      );
      expect(subscriptionRepositoryMock.save).toHaveBeenCalledWith({
        id: undefined,
        user_id: 'user-id',
        status: SubscriptionStatus.PENDING,
        plan: SubscriptionPlan.PLUS,
        current_period_start: NOW,
        current_period_end: NEXT_CHARGE_AT,
        six_months: false,
        is_trial: false,
      });
    });

    it('Должен переиспользовать существующую подписку пользователя', async () => {
      tariffServiceMock.getTariff.mockResolvedValueOnce({
        id: SubscriptionPlan.PRO,
        price: 2_000,
        nextChargeAt: NEXT_CHARGE_AT,
      } as Awaited<ReturnType<TariffService['getTariff']>>);
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce({
        id: 'existing-subscription-id',
      } as Subscription);
      subscriptionRepositoryMock.save.mockResolvedValueOnce({
        id: 'existing-subscription-id',
      } as Subscription);

      await subscriptionService.createSubscription(
        SubscriptionPlan.PRO,
        'user-id',
        true,
      );

      expect(subscriptionRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-subscription-id',
          six_months: true,
        }),
      );
    });

    it('Должен сохранять признак пробного периода из выбранного тарифа', async () => {
      tariffServiceMock.getTariff.mockResolvedValueOnce({
        id: SubscriptionPlan.PLUS,
        name: 'Плюс',
        description: 'Тестовый тариф',
        price: 19_900,
        features: [],
        freeDays: 3,
        nextChargeAt: THREE_DAYS_FROM_NOW,
      });
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce(null);
      subscriptionRepositoryMock.save.mockResolvedValueOnce(
        Object.assign(new Subscription(), { id: 'subscription-id' }),
      );

      await subscriptionService.createSubscription(
        SubscriptionPlan.PLUS,
        'user-id',
        false,
      );

      expect(subscriptionRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          is_trial: true,
          current_period_end: THREE_DAYS_FROM_NOW,
        }),
      );
    });
  });

  describe('resumeSubscription', () => {
    it('Должен атомарно возобновлять только неистёкшую отменённую подписку со способом оплаты', async () => {
      subscriptionRepositoryMock.update.mockResolvedValueOnce({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      await expect(
        subscriptionService.resumeSubscription('user-id'),
      ).resolves.toBeUndefined();

      expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
        [
          {
            user_id: 'user-id',
            status: SubscriptionStatus.CANCELED,
            current_period_end: expect.objectContaining({
              _type: 'moreThan',
              _value: NOW,
            }),
            rebill_id: expect.objectContaining({
              _type: 'moreThan',
              _value: 0,
            }),
          },
          {
            user_id: 'user-id',
            status: SubscriptionStatus.CANCELED,
            current_period_end: expect.objectContaining({
              _type: 'moreThan',
              _value: NOW,
            }),
            account_token: expect.objectContaining({
              _type: 'not',
              _value: '',
            }),
          },
        ],
        { status: SubscriptionStatus.ACTIVE },
      );
      expect(subscriptionRepositoryMock.findOne).not.toHaveBeenCalled();
      expect(tariffServiceMock.getTariff).not.toHaveBeenCalled();
    });

    it('Должен возвращать конфликт, если подписка не соответствует условиям возобновления', async () => {
      subscriptionRepositoryMock.update.mockResolvedValueOnce({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });

      await expect(
        subscriptionService.resumeSubscription('user-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('Должен пробрасывать ошибку базы данных без успешного ответа', async () => {
      const error = new Error('Database unavailable');
      subscriptionRepositoryMock.update.mockRejectedValueOnce(error);

      await expect(
        subscriptionService.resumeSubscription('user-id'),
      ).rejects.toBe(error);
    });
  });

  describe('getCurrentSubscriptionForUser', () => {
    const subscription = Object.assign(new Subscription(), {
      user_id: 'user-id',
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      current_period_end: NEXT_CHARGE_AT,
      six_months: false,
      is_trial: false,
      rebill_id: 123,
      account_token: 'private-token',
    });

    beforeEach(() => {
      tariffServiceMock.getTariff.mockResolvedValue({
        id: SubscriptionPlan.PLUS,
        name: 'Плюс',
        description: 'Тестовый тариф',
        price: 19_900,
        features: [],
        nextChargeAt: NEXT_CHARGE_AT,
      });
    });

    it('Должен возвращать null без текущей подписки и не рассчитывать тариф', async () => {
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce(null);

      await expect(
        subscriptionService.getCurrentSubscriptionForUser('user-id'),
      ).resolves.toBeNull();

      expect(tariffServiceMock.getTariff).not.toHaveBeenCalled();
    });

    it('Должен искать активную или неистёкшую отменённую подписку только текущего пользователя', async () => {
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce(subscription);

      await subscriptionService.getCurrentSubscriptionForUser('user-id');

      expect(subscriptionRepositoryMock.findOne).toHaveBeenCalledWith({
        select: {
          plan: true,
          status: true,
          current_period_end: true,
          six_months: true,
          is_trial: true,
        },
        where: [
          { user_id: 'user-id', status: SubscriptionStatus.ACTIVE },
          {
            user_id: 'user-id',
            status: SubscriptionStatus.CANCELED,
            current_period_end: expect.objectContaining({
              _type: 'moreThan',
              _value: NOW,
            }),
          },
        ],
      });
    });

    it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED])(
      'Должен возвращать сумму продления в копейках и только публичные поля для статуса %s',
      async (status) => {
        subscriptionRepositoryMock.findOne.mockResolvedValueOnce({
          ...subscription,
          status,
        });

        await expect(
          subscriptionService.getCurrentSubscriptionForUser('user-id'),
        ).resolves.toEqual({
          plan: SubscriptionPlan.PLUS,
          status,
          current_period_end: NEXT_CHARGE_AT,
          next_payment_amount: 19_900,
          is_trial: false,
        });
        expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
          SubscriptionPlan.PLUS,
          'user-id',
          false,
        );
      },
    );

    it('Должен учитывать шестимесячный период при расчёте суммы продления', async () => {
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce({
        ...subscription,
        six_months: true,
      });
      tariffServiceMock.getTariff.mockResolvedValueOnce({
        id: SubscriptionPlan.PLUS,
        name: 'Плюс',
        description: 'Тестовый тариф',
        price: 107_460,
        features: [],
        nextChargeAt: NEXT_CHARGE_AT,
      });

      const result = await subscriptionService.getCurrentSubscriptionForUser(
        'user-id',
      );

      expect(result.next_payment_amount).toBe(107_460);
      expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
        SubscriptionPlan.PLUS,
        'user-id',
        true,
      );
    });

    it('Должен возвращать сохранённый пробный период после расходования акции и полную сумму следующего списания', async () => {
      subscriptionRepositoryMock.findOne.mockResolvedValueOnce({
        ...subscription,
        is_trial: true,
      });

      await expect(
        subscriptionService.getCurrentSubscriptionForUser('user-id'),
      ).resolves.toMatchObject({
        is_trial: true,
        next_payment_amount: 19_900,
      });
    });
  });

  it('Должен сохранять токен привязанного счёта', async () => {
    await subscriptionService.updateAccountToken(
      'subscription-id',
      'account-token',
    );

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      'subscription-id',
      { account_token: 'account-token' },
    );
  });

  it('Должен сохранять идентификатор рекуррентного платежа', async () => {
    await subscriptionService.updateRebillId('subscription-id', 123);

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      'subscription-id',
      { rebill_id: 123 },
    );
  });

  describe('getExpiredSubscriptions', () => {
    it('Должен искать истёкшие активные подписки вместе с пользователем', async () => {
      subscriptionRepositoryMock.find.mockResolvedValueOnce([]);

      await subscriptionService.getExpiredSubscriptions();

      expect(subscriptionRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          current_period_end: expect.objectContaining({ _value: NOW }),
          status: SubscriptionStatus.ACTIVE,
        },
        relations: ['user'],
      });
    });

    it('Должен использовать переданный статус подписки', async () => {
      subscriptionRepositoryMock.find.mockResolvedValueOnce([]);

      await subscriptionService.getExpiredSubscriptions(
        SubscriptionStatus.CANCELED,
      );

      expect(subscriptionRepositoryMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: SubscriptionStatus.CANCELED,
          }),
        }),
      );
    });
  });

  it('Должен атомарно захватывать просроченную активную подписку для продления', async () => {
    subscriptionRepositoryMock.update.mockResolvedValueOnce({
      affected: 1,
    } as Awaited<ReturnType<Repository<Subscription>['update']>>);

    await expect(
      subscriptionService.claimExpiredSubscription('subscription-id'),
    ).resolves.toBe(true);

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      {
        id: 'subscription-id',
        current_period_end: expect.objectContaining({ _value: NOW }),
        status: SubscriptionStatus.ACTIVE,
      },
      {
        status: SubscriptionStatus.RENEWING,
      },
    );
  });

  it('Не должен захватывать уже обрабатываемую или продлённую подписку', async () => {
    subscriptionRepositoryMock.update.mockResolvedValueOnce({
      affected: 0,
    } as Awaited<ReturnType<Repository<Subscription>['update']>>);

    await expect(
      subscriptionService.claimExpiredSubscription('subscription-id'),
    ).resolves.toBe(false);
  });

  it('Должен искать активные подписки со списанием в ближайшие три дня', async () => {
    subscriptionRepositoryMock.find.mockResolvedValueOnce([]);

    await subscriptionService.getWillBeChargedSubscriptions();

    expect(subscriptionRepositoryMock.find).toHaveBeenCalledWith({
      where: {
        current_period_end: expect.objectContaining({
          _type: 'and',
          _value: [
            expect.objectContaining({ _value: NOW }),
            expect.objectContaining({ _value: THREE_DAYS_FROM_NOW }),
          ],
        }),
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['user'],
    });
  });

  it('Должен помечать подписку истёкшей и очищать её период', async () => {
    await subscriptionService.expireSubscription('subscription-id');

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      'subscription-id',
      {
        current_period_start: null,
        current_period_end: null,
        status: SubscriptionStatus.EXPIRED,
        is_trial: false,
      },
    );
  });

  it('Должен очищать период и признак пробной подписки при неудачном продлении', async () => {
    await subscriptionService.failSubscription('subscription-id');

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      'subscription-id',
      {
        current_period_start: null,
        current_period_end: null,
        status: SubscriptionStatus.FAILED,
        is_trial: false,
      },
    );
  });

  it('Должен отменять активную подписку пользователя', async () => {
    await subscriptionService.cancelSubscription('user-id');

    expect(subscriptionRepositoryMock.update).toHaveBeenCalledWith(
      {
        user_id: 'user-id',
        status: SubscriptionStatus.ACTIVE,
      },
      { status: SubscriptionStatus.CANCELED },
    );
  });
});
