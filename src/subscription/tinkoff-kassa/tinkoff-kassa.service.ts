import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { generateTokenFromBody } from './utils';
import { InitResponse, RebillResponse } from './types';

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

    this.client = axios.create({ baseURL: this.baseUrl });
  }

  // https://www.tbank.ru/kassa/dev/payments/#tag/Standartnyj-platezh/operation/Init
  public async initPayment(
    orderId: string | number,
    amount: number,
    customerKey: string,
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
      SuccessURL: `${this.baseAppUrl}/subscription/success`,
      FailURL: `${this.baseAppUrl}/subscription/fail`,
      // RedirectDueDate: new Date(Date.now() + 30 * 60_000).toJSON(),
      DATA: {
        connection_type: 'Widget',
        OperationInitiatorType: 'R',
        // QR: true,
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

  public async charge(paymentId: string, rebillId: number) {
    const body = this.prepareBody({
      TerminalKey: this.terminalKey,
      PaymentId: paymentId,
      RebillId: rebillId,
      // SendEmail: true,
      // InfoEmail: 'customer@test.com',
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
