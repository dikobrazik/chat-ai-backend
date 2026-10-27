import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User } from 'src/entities/User';
import {
  KassaNotification,
  ReceiptNotification,
} from 'src/payment/webhook/types';
import {
  PAYMENT_NOTIFICATION_STATUSES,
  RECEIPT_NOTIFICATION_STATUSES,
} from 'src/payment/webhook/constants';
import { type Repository } from 'typeorm';

export function createSubscription(
  repository: Repository<Subscription>,
  user: User,
  overrides: Partial<Subscription> = {},
): Promise<Subscription> {
  return repository.save({
    user_id: user.id,
    plan: SubscriptionPlan.PRO,
    status: SubscriptionStatus.PENDING,
    current_period_start: new Date('2026-09-11T08:00:00.000Z'),
    current_period_end: new Date('2026-10-11T08:00:00.000Z'),
    ...overrides,
  });
}

export async function createPayment(
  paymentRepository: Repository<Payment>,
  subscriptionRepository: Repository<Subscription>,
  user: User,
  overrides: Partial<Payment> = {},
): Promise<Payment> {
  const subscription = await createSubscription(subscriptionRepository, user);
  return paymentRepository.save({
    user_id: user.id,
    subscription_id: subscription.id,
    amount: 2_000,
    status: PaymentStatus.NEW,
    ...overrides,
  });
}

export function createPaymentNotification(
  overrides: Partial<KassaNotification> = {},
): KassaNotification {
  return {
    TerminalKey: 'terminal-key',
    OrderId: 'payment-id',
    Success: true,
    Status: PAYMENT_NOTIFICATION_STATUSES.CONFIRMED,
    PaymentId: 123,
    ErrorCode: '0',
    Amount: 2_000,
    CardId: 456,
    Pan: '430000******0777',
    ExpDate: '1228',
    RebillId: 789,
    Token: 'valid-token',
    ...overrides,
  };
}

export function createReceiptNotification(
  overrides: Partial<ReceiptNotification> = {},
): ReceiptNotification {
  return {
    TerminalKey: 'terminal-key',
    OrderId: 'payment-id',
    PaymentId: 123,
    Success: true,
    Status: RECEIPT_NOTIFICATION_STATUSES.RECEIPT,
    ErrorCode: '0',
    ErrorMessage: '',
    Amount: 1_000,
    FiscalNumber: 1,
    ShiftNumber: 1,
    ReceiptDatetime: '2026-09-11T08:00:00.000Z',
    FnNumber: 'test-fn',
    EcrRegNumber: 'test-ecr',
    FiscalDocumentNumber: 1,
    FiscalDocumentAttribute: 1,
    Receipt: {
      ClientInfo: {
        Birthdate: '',
        Citizenship: '',
        'Document\u0421ode': '',
        DocumentData: '',
        Address: '',
      },
      Taxation: 'usn_income',
      Email: 'receipt@example.com',
      Phone: '',
      Customer: '',
      CustomerInn: '',
      Items: [],
      Payments: [
        {
          Cash: 0,
          Electronic: 1_000,
          AdvancePayment: 0,
          Credit: 0,
          Provision: 0,
        },
      ],
    },
    Type: 'Income',
    Token: 'token',
    Ofd: 'test-ofd',
    Url: 'https://ofd.example.com/receipt/1',
    QrCodeUrl: 'https://ofd.example.com/receipt/1/qr',
    CalculationPlace: 'https://app.example.com',
    CashierName: '',
    SettlePlace: 'https://app.example.com',
    ...overrides,
  };
}
