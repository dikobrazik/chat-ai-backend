import { TestBed, type Mocked } from '@suites/unit';
import { Subscription, SubscriptionStatus } from 'src/entities/Subscription';
import { SbpPaymentService } from 'src/payment/sbp-payment/sbp-payment.service';
import { TpayPaymentService } from 'src/payment/tpay-payment/tpay-payment.service';
import { UserService } from 'src/user/user.service';
import { SubscriptionService } from '../../subscription.service';
import { SubscriptionCheckService } from '../subscription-check.service';

const CURRENT_PERIOD_END = new Date('2026-09-11T08:00:00.000Z');
const MONTHLY_PERIOD_START = new Date('2026-08-11T08:00:00.000Z');

const createSubscription = (overrides: Partial<Subscription> = {}) =>
  ({
    id: 'subscription-id',
    user_id: 'user-id',
    current_period_start: MONTHLY_PERIOD_START,
    current_period_end: CURRENT_PERIOD_END,
    six_months: false,
    user: { id: 'user-id', email: 'user@example.com' },
    ...overrides,
  }) as Subscription;

describe(SubscriptionCheckService.name, () => {
  let subscriptionCheckService: SubscriptionCheckService;
  let sbpPaymentServiceMock: Mocked<SbpPaymentService>;
  let tpayPaymentServiceMock: Mocked<TpayPaymentService>;
  let userServiceMock: Mocked<UserService>;
  let subscriptionServiceMock: Mocked<SubscriptionService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SubscriptionCheckService)
      .mock(SbpPaymentService)
      .impl(() => ({ charge: jest.fn() }))
      .mock(TpayPaymentService)
      .impl(() => ({ charge: jest.fn() }))
      .mock(UserService)
      .impl(() => ({ resetSubscription: jest.fn() }))
      .mock(SubscriptionService)
      .impl(() => ({
        claimExpiredSubscription: jest.fn().mockResolvedValue(true),
        expireSubscription: jest.fn(),
        getExpiredSubscriptions: jest.fn(),
      }))
      .compile();

    subscriptionCheckService = unit;
    sbpPaymentServiceMock = unitRef.get(SbpPaymentService);
    tpayPaymentServiceMock = unitRef.get(TpayPaymentService);
    userServiceMock = unitRef.get(UserService);
    subscriptionServiceMock = unitRef.get(SubscriptionService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    subscriptionServiceMock.claimExpiredSubscription.mockResolvedValue(true);
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Должен списывать платёж T-Pay для подписки с RebillId', async () => {
    const subscription = createSubscription({
      rebill_id: 123,
      account_token: 'account-token',
      six_months: true,
    });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      subscription,
    ]);

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(tpayPaymentServiceMock.charge).toHaveBeenCalledWith(
      subscription,
      true,
    );
    expect(sbpPaymentServiceMock.charge).not.toHaveBeenCalled();
  });

  it('Не должен списывать платёж, если подписку уже обрабатывает другой процесс', async () => {
    const subscription = createSubscription({ rebill_id: 123 });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      subscription,
    ]);
    subscriptionServiceMock.claimExpiredSubscription.mockResolvedValueOnce(
      false,
    );

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(
      subscriptionServiceMock.claimExpiredSubscription,
    ).toHaveBeenCalledWith(subscription.id);
    expect(tpayPaymentServiceMock.charge).not.toHaveBeenCalled();
    expect(sbpPaymentServiceMock.charge).not.toHaveBeenCalled();
  });

  it('Должен списывать платёж через СБП для подписки с токеном счёта', async () => {
    const subscription = createSubscription({ account_token: 'account-token' });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      subscription,
    ]);

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(sbpPaymentServiceMock.charge).toHaveBeenCalledWith(
      subscription,
      false,
    );
    expect(tpayPaymentServiceMock.charge).not.toHaveBeenCalled();
  });

  it('Должен завершать подписку и сбрасывать статус пользователя без платёжных реквизитов', async () => {
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      createSubscription(),
    ]);

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(subscriptionServiceMock.expireSubscription).toHaveBeenCalledWith(
      'subscription-id',
    );
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith('user-id');
  });

  it('Должен завершать подписку и сбрасывать статус пользователя при ошибке повторной оплаты через T-Pay', async () => {
    const subscription = createSubscription({
      rebill_id: 123,
      six_months: true,
    });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      subscription,
    ]);
    tpayPaymentServiceMock.charge.mockRejectedValueOnce(
      new Error('Payment failed'),
    );

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(tpayPaymentServiceMock.charge).toHaveBeenCalledWith(
      subscription,
      true,
    );
    expect(subscriptionServiceMock.expireSubscription).toHaveBeenCalledWith(
      subscription.id,
    );
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith(
      subscription.user_id,
    );
  });

  it('Должен завершать подписку и сбрасывать статус пользователя при ошибке повторной оплаты через СБП', async () => {
    const subscription = createSubscription({
      account_token: 'account-token',
    });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      subscription,
    ]);
    sbpPaymentServiceMock.charge.mockRejectedValueOnce(
      new Error('Payment failed'),
    );

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(sbpPaymentServiceMock.charge).toHaveBeenCalledWith(
      subscription,
      false,
    );
    expect(subscriptionServiceMock.expireSubscription).toHaveBeenCalledWith(
      subscription.id,
    );
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith(
      subscription.user_id,
    );
  });

  it('Должен продолжать обработку остальных подписок после ошибки списания', async () => {
    const failedSubscription = createSubscription({
      id: 'failed-subscription-id',
      rebill_id: 123,
    });
    const sbpSubscription = createSubscription({
      id: 'sbp-subscription-id',
      account_token: 'account-token',
    });
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      failedSubscription,
      sbpSubscription,
    ]);
    tpayPaymentServiceMock.charge.mockRejectedValueOnce(
      new Error('Payment failed'),
    );

    await subscriptionCheckService.handleSubscriptionCheck();

    expect(sbpPaymentServiceMock.charge).toHaveBeenCalledWith(
      sbpSubscription,
      false,
    );
    expect(subscriptionServiceMock.expireSubscription).toHaveBeenCalledWith(
      failedSubscription.id,
    );
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith(
      failedSubscription.user_id,
    );
  });

  it('Должен сбрасывать пользователей с истёкшими отменёнными подписками', async () => {
    subscriptionServiceMock.getExpiredSubscriptions.mockResolvedValueOnce([
      createSubscription({ user_id: 'first-user-id' }),
      createSubscription({ user_id: 'second-user-id' }),
    ]);

    await subscriptionCheckService.handleCanceledSubscriptionCheck();

    expect(
      subscriptionServiceMock.getExpiredSubscriptions,
    ).toHaveBeenCalledWith(SubscriptionStatus.CANCELED);
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith(
      'first-user-id',
    );
    expect(userServiceMock.resetSubscription).toHaveBeenCalledWith(
      'second-user-id',
    );
  });
});
