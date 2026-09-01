import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { generateTokenFromBody } from './utils';
import {
  GetLinkResponse,
  GetLinkStatusResponse,
  InitResponse,
  RebillResponse,
} from './types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Agent } from 'https';

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
  public async initPayment(
    orderId: string | number,
    amount: number,
    customerKey: string,
    customerEmail: string,
  ): Promise<InitResponse> {
    const body: Record<string, any> = this.prepareBody({
      TerminalKey: this.terminalKey,
      Amount: amount,
      OrderId: String(orderId),
      Description: 'Подписка на сервис',
      CustomerKey: customerKey,
      Recurrent: 'Y',
      // PayType: 'O',
      // Language: 'ru',
      NotificationURL: `${this.baseApiUrl}/subscription/notify`,
      SuccessURL: `${this.baseAppUrl}/payment/success`,
      FailURL: `${this.baseAppUrl}/payment/fail`,
      // RedirectDueDate: new Date(Date.now() + 30 * 60_000).toJSON(),
      Receipt: {
        Items: [
          {
            Name: 'Подписка на сервис',
            Price: amount,
            Quantity: 1,
            Amount: amount,
            Tax: 'none',
          },
        ],
        Taxation: 'usn_income',
        Email: customerEmail,
      },
      DATA: {
        TinkoffPayWeb: true,
        Device: 'Desktop',
        DeviceOs: 'iOS',
        DeviceWebView: true,
        OperationInitiatorType: 'R',
        Email: customerEmail,
      },
    });

    const response = await this.client
      .post<InitResponse>('/Init', body)
      .then((r) => r.data);

    console.warn('Init response', body, response);

    if (!response.Success) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/status
  public async checkTPayLink(): Promise<GetLinkStatusResponse> {
    const response = await this.client
      .get<GetLinkStatusResponse>(
        `TinkoffPay/terminals/${this.terminalKey}/status`,
      )
      .then((r) => r.data);

    console.warn('GetTPayStatus', response);

    if (!response.Success) {
      throw new InternalServerErrorException();
    }

    return response;
  }

  // https://developer.tbank.ru/eacq/api/link
  public async getTPayLink(
    paymentId: string,
    version: string = '2.0',
  ): Promise<GetLinkResponse> {
    const response = await this.client
      .get<GetLinkResponse>(
        `/TinkoffPay/transactions/${paymentId}/versions/${version}/link`,
      )
      .then((r) => r.data);

    console.warn('GetTPayLink', response);

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
      .post<RebillResponse>('/Charge', body)
      .then((r) => r.data);

    console.warn('Charge response', body, response);

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
}
