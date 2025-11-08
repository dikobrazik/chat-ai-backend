export type InitResponse = {
  Success: boolean;
  ErrorCode: string;
  TerminalKey: string;
  Status: string;
  PaymentId: string;
  OrderId: string;
  Amount: number;
  PaymentURL: string;
};

export type GetQrResponse = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Data: string;
  PaymentId: string;
  ErrorCode: string;
  Message: string;
  Details: string;
  RequestKey: string;
};

export type KassaNotification = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: string;
  PaymentId: number;
  ErrorCode: string;
  Amount: number;
  CardId: number;
  Pan: string;
  ExpDate: string;
  RebillId: number;
  Token: string;
};

export type CancelResponse = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: string;
  OriginalAmount: number;
  NewAmount: number;
  PaymentId: string;
  ErrorCode: string;
  Message: string;
  Details: string;
  ExternalRequestId: string;
};

export type RebillResponse = {
  TerminalKey: string;
  Amount: number;
  OrderId: string;
  Success: boolean;
  Status: string;
  PaymentId: string;
  ErrorCode: string;
};
