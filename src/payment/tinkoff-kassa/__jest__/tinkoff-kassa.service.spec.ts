jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('test-ca')),
}));
jest.mock('https', () => ({ Agent: jest.fn() }));

import { TestBed, type Mocked } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { type InitRequest } from '../generated';
import { TinkoffKassaService } from '../tinkoff-kassa.service';
import { generateTokenFromBody } from '../utils';

const config = {
  KASSA_BASE_URL: 'https://kassa.example.com',
  BASE_APP_URL: 'https://app.example.com',
  BASE_URL: 'https://api.example.com',
  KASSA_TERMINAL_KEY: 'terminal-key',
  KASSA_PASSWORD: 'password',
};

const paymentPayload: Pick<
  InitRequest,
  'Amount' | 'CustomerKey' | 'OrderId' | 'DATA'
> & { Email: string } = {
  Amount: 1_000,
  CustomerKey: 'user-id',
  OrderId: 'payment-id',
  Email: 'user@example.com',
  DATA: { OperationInitiatorType: 'R' },
};

describe(TinkoffKassaService.name, () => {
  let kassaService: TinkoffKassaService;
  let configServiceMock: Mocked<ConfigService>;
  const postMock = jest.fn();
  const getMock = jest.fn();

  beforeAll(async () => {
    jest.mocked(axios.create).mockReturnValue({
      post: postMock,
      get: getMock,
    } as unknown as AxiosInstance);

    const { unit, unitRef } = await TestBed.solitary(TinkoffKassaService)
      .mock(ConfigService)
      .impl(() => ({
        getOrThrow: jest.fn((key: keyof typeof config) => config[key]),
      }))
      .compile();

    kassaService = unit;
    configServiceMock = unitRef.get(ConfigService);
  });

  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Должен инициализировать HTTP-клиент с настройками кассы', () => {
    expect(configServiceMock.getOrThrow).toHaveBeenCalledWith('KASSA_BASE_URL');
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: config.KASSA_BASE_URL,
      httpsAgent: expect.anything(),
    });
  });

  describe('createPayment', () => {
    it('Должен отправить подписочный платёж с подписанным телом запроса', async () => {
      const response = {
        Success: true,
        PaymentId: 'external-payment-id',
      };
      postMock.mockResolvedValueOnce({ data: response });

      await expect(kassaService.createPayment(paymentPayload)).resolves.toBe(
        response,
      );

      expect(postMock).toHaveBeenCalledWith(
        '/Init',
        expect.objectContaining({
          TerminalKey: 'terminal-key',
          Amount: 1_000,
          OrderId: 'payment-id',
          CustomerKey: 'user-id',
          Recurrent: 'Y',
          NotificationURL: 'https://api.example.com/webhook/notify',
          SuccessURL: 'https://app.example.com/payment/success',
          FailURL: 'https://app.example.com/payment/fail',
          DATA: { OperationInitiatorType: 'R' },
          Receipt: expect.objectContaining({ Email: 'user@example.com' }),
        }),
      );
      expect(kassaService.checkToken(postMock.mock.calls[0][1])).toBeTruthy();
    });
  });

  describe('checkTPayLink', () => {
    it('Должен вернуть доступную версию T-Pay', async () => {
      const response = { Success: true, Params: { Version: '2.1' } };
      getMock.mockResolvedValueOnce({ data: response });

      await expect(kassaService.checkTPayLink()).resolves.toBe(response);

      expect(getMock).toHaveBeenCalledWith(
        'TinkoffPay/terminals/terminal-key/status',
      );
    });
  });

  describe('getTPayLink', () => {
    it('Должен запросить ссылку для переданной версии T-Pay', async () => {
      const response = {
        Success: true,
        Params: { RedirectUrl: 'https://pay.example.com', WebQR: 'qr-data' },
      };
      getMock.mockResolvedValueOnce({ data: response });

      await expect(
        kassaService.getTPayLink('external-payment-id', '2.1'),
      ).resolves.toBe(response);

      expect(getMock).toHaveBeenCalledWith(
        '/TinkoffPay/transactions/external-payment-id/versions/2.1/link',
      );
    });
  });

  describe('addAccountQr', () => {
    it('Должен запросить QR-код со сроком действия 30 минут', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-11T08:00:00.000Z'));
      const response = {
        Success: true,
        RequestKey: 'request-key',
        Data: '<svg />',
      };
      postMock.mockResolvedValueOnce({ data: response });

      await expect(kassaService.addAccountQr()).resolves.toBe(response);

      expect(postMock).toHaveBeenCalledWith(
        '/AddAccountQr',
        expect.objectContaining({
          TerminalKey: 'terminal-key',
          Description: 'Подписка на сервис Jonu',
          DataType: 'IMAGE',
          RedirectDueDate: '2026-09-11T11:30:00+03:00',
        }),
      );
      expect(kassaService.checkToken(postMock.mock.calls[0][1])).toBeTruthy();
      jest.useRealTimers();
    });
  });

  describe('chargeQr', () => {
    it('Должен списать средства с привязанного СБП-счёта', async () => {
      const response = { Success: true };
      postMock.mockResolvedValueOnce({ data: response });

      await expect(
        kassaService.chargeQr('external-payment-id', 'account-token'),
      ).resolves.toBe(response);

      expect(postMock).toHaveBeenCalledWith(
        '/ChargeQr',
        expect.objectContaining({
          TerminalKey: 'terminal-key',
          PaymentId: 'external-payment-id',
          AccountToken: 'account-token',
        }),
      );
    });
  });

  describe('charge', () => {
    it('Должен списать средства по рекуррентному идентификатору', async () => {
      const response = { Success: true };
      postMock.mockResolvedValueOnce({ data: response });

      await expect(
        kassaService.charge('external-payment-id', 123, 'user@example.com'),
      ).resolves.toBe(response);

      expect(postMock).toHaveBeenCalledWith(
        '/Charge',
        expect.objectContaining({
          TerminalKey: 'terminal-key',
          PaymentId: 'external-payment-id',
          RebillId: 123,
          SendEmail: true,
          InfoEmail: 'user@example.com',
        }),
      );
    });
  });

  it.each([
    [
      'инициализации платежа',
      () => kassaService.createPayment(paymentPayload),
      postMock,
    ],
    ['проверки доступности T-Pay', () => kassaService.checkTPayLink(), getMock],
    [
      'получения ссылки T-Pay',
      () => kassaService.getTPayLink('external-payment-id'),
      getMock,
    ],
    ['создания QR-кода', () => kassaService.addAccountQr(), postMock],
    [
      'списания через СБП',
      () => kassaService.chargeQr('external-payment-id', 'account-token'),
      postMock,
    ],
    [
      'рекуррентного списания',
      () => kassaService.charge('external-payment-id', 123, 'user@example.com'),
      postMock,
    ],
  ])(
    'Должен вернуть внутреннюю ошибку при неуспешном ответе %s',
    async (_operation, call, clientMethod) => {
      clientMethod.mockResolvedValueOnce({ data: { Success: false } });

      await expect(call()).rejects.toThrow(InternalServerErrorException);
    },
  );

  describe('checkToken', () => {
    it('Должен принять корректный токен и отклонить изменённое тело', () => {
      const body = {
        TerminalKey: 'terminal-key',
        Amount: 1_000,
        Token: generateTokenFromBody(
          { TerminalKey: 'terminal-key', Amount: 1_000 },
          config.KASSA_PASSWORD,
        ),
      };

      expect(kassaService.checkToken(body)).toBe(true);
      expect(kassaService.checkToken({ ...body, Amount: 2_000 })).toBe(false);
    });
  });
});
