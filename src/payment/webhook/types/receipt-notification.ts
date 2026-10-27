import { RECEIPT_NOTIFICATION_STATUSES } from 'src/payment/webhook/constants';

export type ReceiptNotification = {
  TerminalKey: string;
  OrderId: string;
  Success: boolean;
  Status: keyof typeof RECEIPT_NOTIFICATION_STATUSES;
  PaymentId: number;
  ErrorCode: string;
  ErrorMessage: string;
  Amount: number;
  FiscalNumber: number;
  ShiftNumber: number;
  ReceiptDatetime: string;
  FnNumber: string;
  EcrRegNumber: string;
  FiscalDocumentNumber: number;
  FiscalDocumentAttribute: number;
  Receipt: Receipt;
  Type: string;
  Token: string;
  Ofd: string;
  Url: string;
  QrCodeUrl: string;
  CalculationPlace: string;
  CashierName: string;
  SettlePlace: string;
};

type Receipt = {
  ClientInfo: ClientInfo;
  Taxation: string;
  Email: string;
  Phone: string;
  Customer: string;
  CustomerInn: string;
  Items: Item[];
  Payments: Payment[];
};

type Payment = {
  Cash: number;
  Electronic: number;
  AdvancePayment: number;
  Credit: number;
  Provision: number;
};

type Item = {
  AgentData: AgentData;
  SupplierInfo: SupplierInfo;
  Name: string;
  Price: number;
  Quantity: number;
  Amount: number;
  Tax: string;
  PaymentMethod: string;
  PaymentObject: string;
  UserData: string;
  Excise: string;
  CountryCode: string;
  DeclarationNumber: string;
  MeasurementUnit: string;
  MarkProcessingMode: string;
  MarkCode: MarkCode;
  MarkQuantity: MarkQuantity;
  SectoralItemProps: SectoralItemProps;
};

type SectoralItemProps = {
  FederalId: string;
  Date: string;
  Number: string;
  Value: string;
};

type MarkQuantity = {
  Numerator: number;
  Denominator: number;
};

type MarkCode = {
  MarkCodeType: string;
  Value: string;
};

type SupplierInfo = {
  Phones: string[];
  Name: string;
  Inn: string;
};

type AgentData = {
  AgentSign: string;
  OperationName: string;
  Phones: string[];
  ReceiverPhones: string[];
  TransferPhones: string[];
  OperatorName: string;
  OperatorAddress: string;
  OperatorInn: string;
};

type ClientInfo = {
  Birthdate: string;
  Citizenship: string;
  DocumentСode: string;
  DocumentData: string;
  Address: string;
};
