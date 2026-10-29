import { PAYMENT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';

export type KassaNotification = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: keyof typeof PAYMENT_NOTIFICATION_STATUSES;
  PaymentId: number;
  ErrorCode: string;
  Amount: number;
  CardId: number;
  Pan?: string;
  ExpDate: string;
  RebillId: number;
  Token: string;
};
