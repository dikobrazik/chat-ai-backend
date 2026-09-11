import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { addMinutes } from 'date-fns';
import { readFileSync } from 'fs';
import { Agent } from 'https';
import { join } from 'path';
import {
  ChargeQrResponse,
  ErrorResponse,
  Init200Response,
  InitRequest,
  InitResponse,
  Link200Response,
  Link200ResponseOneOf,
  Status200Response,
  Status200ResponseOneOf,
  AddAccountQrResponse,
  Charge200Response,
} from './generated';
import { formatMoscowDate, generateTokenFromBody } from './utils';

@Injectable()
export class TinkoffKassaService {
  private client: AxiosInstance;

  private baseUrl: string;
  private baseAppUrl: string;
  private baseApiUrl: string;
  private terminalKey: string;
  private password: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.getOrThrow('KASSA_BASE_URL');
    this.baseAppUrl = this.configService.getOrThrow('BASE_APP_URL');
    this.baseApiUrl = this.configService.getOrThrow('BASE_URL');
    this.terminalKey = this.configService.getOrThrow('KASSA_TERMINAL_KEY');
    this.password = this.configService.getOrThrow('KASSA_PASSWORD');

    const caCert = readFileSync(join('./russian_trusted_root_ca_pem.crt'));
    const agent = new Agent({
      ca: caCert,
    });

    this.client = axios.create({ baseURL: this.baseUrl, httpsAgent: agent });
  }

  // https://www.tbank.ru/kassa/dev/payments/#tag/Standartnyj-platezh/operation/Init
  public async createPayment(
    payload: Pick<
      InitRequest,
      'Amount' | 'CustomerKey' | 'OrderId' | 'DATA'
    > & {
      Email: string;
    },
  ): Promise<InitResponse> {
    const body: InitRequest = this.prepareBody<Omit<InitRequest, 'Token'>>({
      TerminalKey: this.terminalKey,
      Amount: payload.Amount,
      OrderId: String(payload.OrderId),
      Description: 'Подписка на сервис Jonu',
      CustomerKey: payload.CustomerKey,
      Recurrent: 'Y',
      NotificationURL: `${this.baseApiUrl}/webhook/notify`,
      SuccessURL: `${this.baseAppUrl}/payment/success`,
      FailURL: `${this.baseAppUrl}/payment/fail`,
      Receipt: {
        Items: [
          {
            Name: 'Подписка на сервис Jonu',
            Price: payload.Amount,
            Quantity: 1,
            Amount: payload.Amount,
            Tax: 'none',
          },
        ],
        Taxation: 'usn_income',
        Email: payload.Email,
      },
      DATA: payload.DATA,
    });

    const response = await this.client
      .post<Init200Response>('/Init', body)
      .then((r) => r.data);

    console.log('Init response', body, response);

    if (this.isErrorResponse(response)) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/status
  public async checkTPayLink(): Promise<Status200ResponseOneOf> {
    const response = await this.client
      .get<Status200Response>(`TinkoffPay/terminals/${this.terminalKey}/status`)
      .then((r) => r.data);

    console.log('GetTPayStatus', response);

    if (this.isErrorResponse(response)) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/link
  public async getTPayLink(
    paymentId: string,
    version: string = '2.0',
  ): Promise<Link200ResponseOneOf> {
    const response = await this.client
      .get<Link200Response>(
        `/TinkoffPay/transactions/${paymentId}/versions/${version}/link`,
      )
      .then((r) => r.data);

    console.log('GetTPayLink', response);

    if (this.isErrorResponse(response)) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/add-account-qr
  public async addAccountQr(): Promise<AddAccountQrResponse> {
    const response = await this.client
      .post<AddAccountQrResponse>(
        `/AddAccountQr`,
        this.prepareBody({
          TerminalKey: this.terminalKey,
          Description: 'Подписка на сервис Jonu',
          DataType: 'IMAGE',
          RedirectDueDate: formatMoscowDate(addMinutes(new Date(), 30)),
        }),
      )
      .then((r) => r.data);

    console.log('AddAccountQr', response);

    if (!response.Success) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/add-account-qr
  public async chargeQr(
    paymentId: string,
    accountToken: string,
  ): Promise<ChargeQrResponse> {
    const response = await this.client
      .post<ChargeQrResponse>(
        `/ChargeQr`,
        this.prepareBody({
          TerminalKey: this.terminalKey,
          PaymentId: paymentId,
          AccountToken: accountToken,
          // SendEmail: true,
          // InfoEmail: '',
          // BankMemberId: '',
        }),
      )
      .then((r) => r.data);

    console.log('AddAccountQr', response);

    if (!response.Success) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  public async charge(
    paymentId: string,
    rebillId: number,
    customerEmail: string,
  ) {
    const body = this.prepareBody({
      TerminalKey: this.terminalKey,
      PaymentId: paymentId,
      RebillId: rebillId,
      SendEmail: true,
      InfoEmail: customerEmail,
    });

    const response = await this.client
      .post<Charge200Response>('/Charge', body)
      .then((r) => r.data);

    console.log('Charge response', body, response);

    if (!response.Success) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  private prepareBody<Body extends Record<string, any>>(
    body: Body,
  ): Body & { Token: string } {
    return {
      ...body,
      Token: generateTokenFromBody(body, this.password),
    };
  }

  public checkToken<Body extends Record<string, any>>(body: Body): boolean {
    const { Token, ...bodyWithoutToken } = body;
    const token = generateTokenFromBody(bodyWithoutToken, this.password);

    return Token === token;
  }

  private isErrorResponse<T extends { Success: boolean }>(
    response: T | ErrorResponse,
  ): response is ErrorResponse {
    return response.Success === false;
  }
}
