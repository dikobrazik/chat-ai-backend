import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Payment, PaymentStatus } from 'src/entities/Payment';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from 'src/entities/Subscription';
import { User, UserStatus } from 'src/entities/User';
import { In, Repository } from 'typeorm';
import { isURL } from 'class-validator';
import { SbpPaymentService } from '../sbp-payment/sbp-payment.service';
import { TinkoffKassaService } from '../tinkoff-kassa/tinkoff-kassa.service';
import {
  LINK_ACCOUNT_NOTIFICATION_STATUSES,
  PAYMENT_NOTIFICATION_STATUSES,
  RECEIPT_NOTIFICATION_STATUSES,
} from './constants';
import {
  KassaNotification,
  ReceiptNotification,
  WebhookNotification,
} from './types';
import { PromotionService } from 'src/promotion/promotion.service';
import { FIRST_SUBSCRIPTION_PROMOTION_ID } from 'src/promotion/constants';
import { TariffService } from 'src/tariff/tariff.service';

const SUBSCRIPTION_PLAN_USER_STATUS_MAP = {
  [SubscriptionPlan.PLUS]: UserStatus.SUBSCRIPTION_PLUS,
  [SubscriptionPlan.PRO]: UserStatus.SUBSCRIPTION_PRO,
};

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  @InjectRepository(User)
  private userRepository: Repository<User>;
  @InjectRepository(Payment)
  private paymentRepository: Repository<Payment>;
  @InjectRepository(Subscription)
  private subscriptionRepository: Repository<Subscription>;

  @Inject(SbpPaymentService)
  private sbpService: SbpPaymentService;
  @Inject(TinkoffKassaService)
  private kassaService: TinkoffKassaService;
  @Inject(PromotionService)
  private promotionService: PromotionService;
  @Inject(TariffService)
  private tariffService: TariffService;

  public async processNotification(notification: WebhookNotification) {
    const isTokenValid = this.kassaService.checkToken(notification);

    if (isTokenValid) {
      if (notification.Status === RECEIPT_NOTIFICATION_STATUSES.RECEIPT) {
        await this.saveReceipt(notification);
        return;
      }

      const { Status, Success } = notification;

      this.logger.log(notification);

      if (!Success) {
        if ('OrderId' in notification) {
          await this.rejectPayment(notification.OrderId);
        }
      } else if (Status === PAYMENT_NOTIFICATION_STATUSES.REJECTED) {
        await this.rejectPayment((notification as KassaNotification).OrderId);
      } else if (Status === PAYMENT_NOTIFICATION_STATUSES.CONFIRMED) {
        await this.updateSubscriptionAndUserStatus(notification);
      } else if (Status === PAYMENT_NOTIFICATION_STATUSES.REFUNDED) {
        const result = await this.paymentRepository.update(
          notification.OrderId,
          {
            status: PaymentStatus.REFUNDED,
          },
        );
        if (result.affected !== 1) {
          throw new BadRequestException('Payment not found');
        }
      } else if (Status === LINK_ACCOUNT_NOTIFICATION_STATUSES.ACTIVE) {
        await this.sbpService.onAccountLinked(notification);
      }
    } else {
      throw new BadRequestException();
    }
  }

  private async updateSubscriptionAndUserStatus(
    notification: KassaNotification,
  ) {
    const orderId = notification.OrderId;
    const payment = await this.paymentRepository.findOne({
      where: { id: orderId },
      relations: { subscription: true },
    });

    if (!payment) {
      this.logger.error(
        `Payment with orderId ${orderId} not found`,
        notification,
      );
      throw new BadRequestException('Payment not found');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      return;
    }

    const tariff = await this.tariffService.getTariff(
      payment.subscription.plan,
      payment.user_id,
      payment.subscription.six_months,
    );

    await Promise.all([
      this.promotionService.markPromotionAsUsed(
        FIRST_SUBSCRIPTION_PROMOTION_ID,
        payment.user_id,
        payment.id,
      ),
      this.paymentRepository.update(payment.id, {
        status: PaymentStatus.CONFIRMED,
        payment_date:
          payment.status === PaymentStatus.CONFIRMED
            ? payment.payment_date
            : new Date(),
      }),
      this.subscriptionRepository.update(payment.subscription_id, {
        status: SubscriptionStatus.ACTIVE,
        rebill_id: notification.RebillId,
        current_period_start: new Date(),
        current_period_end: tariff.nextChargeAt,
        is_trial: Boolean(tariff.freeDays),
      }),
      this.userRepository.update(payment.user_id, {
        status: SUBSCRIPTION_PLAN_USER_STATUS_MAP[payment.subscription.plan],
      }),
    ]);
  }

  private async rejectPayment(orderId: string) {
    await this.paymentRepository.update(
      {
        id: orderId,
        status: In([PaymentStatus.NEW, PaymentStatus.FORM_SHOWN]),
      },
      {
        status: PaymentStatus.REJECTED,
        payment_date: new Date(),
      },
    );
  }

  private async saveReceipt(notification: ReceiptNotification) {
    if (!notification.Success) {
      this.logger.warn(
        `Fiscalization failed for payment ${notification.OrderId}: ${notification.ErrorCode}`,
      );
      return;
    }

    if (notification.Url == null) {
      this.logger.warn(
        `Receipt URL is missing for payment ${notification.OrderId}`,
      );
      return;
    }

    if (
      typeof notification.Url !== 'string' ||
      !isURL(notification.Url, {
        protocols: ['https', 'http'],
        require_protocol: true,
        disallow_auth: true,
      })
    ) {
      throw new BadRequestException('Invalid receipt URL');
    }

    const result = await this.paymentRepository.update(notification.OrderId, {
      receipt_url: notification.Url,
    });
    if (result.affected !== 1) {
      throw new BadRequestException('Payment not found');
    }
  }
}
