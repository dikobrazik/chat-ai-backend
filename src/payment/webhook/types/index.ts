import type { AddAccountQrNotification } from './add-account-qr-notification';
import type { KassaNotification } from './kassa-notification';
import type { ReceiptNotification } from './receipt-notification';

export type {
  AddAccountQrNotification,
  KassaNotification,
  ReceiptNotification,
};

export type WebhookNotification =
  | KassaNotification
  | AddAccountQrNotification
  | ReceiptNotification;
