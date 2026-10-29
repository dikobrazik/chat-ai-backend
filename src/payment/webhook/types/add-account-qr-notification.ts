import { LINK_ACCOUNT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';

export type AddAccountQrNotification = {
  TerminalKey: string;
  RequestKey: string;
  Status: keyof typeof LINK_ACCOUNT_NOTIFICATION_STATUSES;
  Success: boolean;
  ErrorCode: string;
  Message: string;
  AccountToken: string;
  BankMemberId: string;
  BankMemberName?: string;
  Token: string;
  NotificationType: string;
};
