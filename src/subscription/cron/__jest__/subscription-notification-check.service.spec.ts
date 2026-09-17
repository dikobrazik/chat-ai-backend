import { TestBed, type Mocked } from '@suites/unit';
import { Subscription, SubscriptionPlan } from 'src/entities/Subscription';
import { MailerService } from 'src/mailer/mailer.service';
import {
  PaymentAmountService,
  PaymentMethod,
} from 'src/payment/payment-amount.service';
import { TariffService } from 'src/tariff/tariff.service';
import { SubscriptionNotificationService } from '../../subscription-notification.service';
import { SubscriptionService } from '../../subscription.service';
import { SubscriptionNotificationCheckService } from '../subscription-notification-check.service';

const CURRENT_PERIOD_END = new Date('2026-09-20T08:00:00.000Z');

const createSubscription = () =>
  ({
    id: 'subscription-id',
    user_id: 'user-id',
    plan: SubscriptionPlan.PLUS,
    six_months: false,
    current_period_end: CURRENT_PERIOD_END,
    user: { id: 'user-id', email: 'user@example.com' },
  }) as Subscription;

describe(SubscriptionNotificationCheckService.name, () => {
  let notificationCheckService: SubscriptionNotificationCheckService;
  let subscriptionServiceMock: Mocked<SubscriptionService>;
  let notificationServiceMock: Mocked<SubscriptionNotificationService>;
  let mailerServiceMock: Mocked<MailerService>;
  let tariffServiceMock: Mocked<TariffService>;
  let paymentAmountServiceMock: Mocked<PaymentAmountService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      SubscriptionNotificationCheckService,
    )
      .mock(SubscriptionService)
      .impl(() => ({ getWillBeChargedSubscriptions: jest.fn() }))
      .mock(SubscriptionNotificationService)
      .impl(() => ({
        claimChargeReminder: jest.fn(),
        markChargeReminderSent: jest.fn(),
        markChargeReminderFailed: jest.fn(),
      }))
      .mock(MailerService)
      .impl(() => ({ sendChargeNotification: jest.fn() }))
      .mock(TariffService)
      .impl(() => ({ getTariff: jest.fn() }))
      .mock(PaymentAmountService)
      .impl(() => ({ getAmount: jest.fn() }))
      .compile();

    notificationCheckService = unit;
    subscriptionServiceMock = unitRef.get(SubscriptionService);
    notificationServiceMock = unitRef.get(SubscriptionNotificationService);
    mailerServiceMock = unitRef.get(MailerService);
    tariffServiceMock = unitRef.get(TariffService);
    paymentAmountServiceMock = unitRef.get(PaymentAmountService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Должен один раз отправить уведомление и пометить его отправленным', async () => {
    const subscription = createSubscription();
    subscriptionServiceMock.getWillBeChargedSubscriptions.mockResolvedValueOnce(
      [subscription],
    );
    notificationServiceMock.claimChargeReminder.mockResolvedValueOnce(true);
    tariffServiceMock.getTariff.mockResolvedValueOnce({
      id: SubscriptionPlan.PLUS,
      price: 1_000,
    } as Awaited<ReturnType<TariffService['getTariff']>>);
    paymentAmountServiceMock.getAmount.mockReturnValueOnce(1_000);

    await notificationCheckService.handleChargeReminderCheck();

    expect(notificationServiceMock.claimChargeReminder).toHaveBeenCalledWith(
      subscription.id,
      subscription.current_period_end,
    );
    expect(tariffServiceMock.getTariff).toHaveBeenCalledWith(
      SubscriptionPlan.PLUS,
      subscription.user_id,
      false,
    );
    expect(paymentAmountServiceMock.getAmount).toHaveBeenCalledWith(
      expect.objectContaining({ id: SubscriptionPlan.PLUS }),
      PaymentMethod.SBP,
    );
    expect(mailerServiceMock.sendChargeNotification).toHaveBeenCalledWith({
      to: subscription.user.email,
      name: undefined,
      plan: SubscriptionPlan.PLUS,
      chargeDate: subscription.current_period_end,
      amount: 1_000,
    });
    expect(notificationServiceMock.markChargeReminderSent).toHaveBeenCalledWith(
      subscription.id,
      subscription.current_period_end,
    );
  });

  it('Не должен повторно отправлять уже захваченное уведомление', async () => {
    const subscription = createSubscription();
    subscriptionServiceMock.getWillBeChargedSubscriptions.mockResolvedValueOnce(
      [subscription],
    );
    notificationServiceMock.claimChargeReminder.mockResolvedValueOnce(false);

    await notificationCheckService.handleChargeReminderCheck();

    expect(mailerServiceMock.sendChargeNotification).not.toHaveBeenCalled();
    expect(
      notificationServiceMock.markChargeReminderSent,
    ).not.toHaveBeenCalled();
  });

  it('Должен пометить уведомление ошибочным при сбое отправки', async () => {
    const subscription = createSubscription();
    subscriptionServiceMock.getWillBeChargedSubscriptions.mockResolvedValueOnce(
      [subscription],
    );
    notificationServiceMock.claimChargeReminder.mockResolvedValueOnce(true);
    tariffServiceMock.getTariff.mockResolvedValueOnce({
      id: SubscriptionPlan.PLUS,
      price: 1_000,
    } as Awaited<ReturnType<TariffService['getTariff']>>);
    paymentAmountServiceMock.getAmount.mockReturnValueOnce(1_000);
    mailerServiceMock.sendChargeNotification.mockRejectedValueOnce(
      new Error('Mail failed'),
    );

    await notificationCheckService.handleChargeReminderCheck();

    expect(
      notificationServiceMock.markChargeReminderFailed,
    ).toHaveBeenCalledWith(subscription.id, subscription.current_period_end);
    expect(
      notificationServiceMock.markChargeReminderSent,
    ).not.toHaveBeenCalled();
  });
});
