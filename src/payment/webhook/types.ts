import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
} from './constants';

export interface AddAccountQrNotification {
  TerminalKey: string;
  RequestKey: string;
  Status: keyof typeof LINK_ACCOUNT_NOTIFICATION_STATUSES;
  Success: boolean;
  ErrorCode: string;
  Message: string;
  AccountToken: string;
  BankMemberId: string;
  BankMemberName: string;
  Token: string;
  NotificationType: string;
}

export type KassaNotification = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: keyof typeof PAYMENT_NOTIFICATION_STATUSES;
  PaymentId: number;
  ErrorCode: string;
  Amount: number;
  CardId: number;
  Pan: string;
  ExpDate: string;
  RebillId: number;
  Token: string;
};
