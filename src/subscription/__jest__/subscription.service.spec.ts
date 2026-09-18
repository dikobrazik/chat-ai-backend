import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
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
