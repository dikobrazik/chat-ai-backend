import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { Subscription } from 'src/entities/Subscription';
import { In, Repository } from 'typeorm';
import { PaymentMethod } from './payment-amount.service';

export type PaymentHistoryItem = Pick<
  Payment,
  'id' | 'amount' | 'status' | 'payment_date' | 'receipt_url'
>;

export type PaymentMethodInfo = {
  type: PaymentMethod.SBP | PaymentMethod.TPAY;
  description: string | null;
};

@Injectable()
export class PaymentService {
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;

  @InjectRepository(Subscription)
  private readonly subscriptionRepository: Repository<Subscription>;

  public async removeMethod(userId: string): Promise<void> {
    await this.subscriptionRepository.update(
      { user_id: userId },
      {
        rebill_id: null,
        account_token: null,
        pan: null,
        payment_method_link_request_key: null,
        payment_method_deleted_at: new Date(),
      },
    );
  }

  public async getMethod(userId: string): Promise<PaymentMethodInfo | null> {
    const subscription = await this.subscriptionRepository.findOne({
      select: {
        rebill_id: true,
        account_token: true,
        pan: true,
      },
      where: { user_id: userId },
    });

    if (!subscription) {
      return null;
    }

    if (Number(subscription.rebill_id) > 0) {
      return {
        type: PaymentMethod.TPAY,
        description: subscription.pan,
      };
    }

    if (subscription.account_token) {
      return {
        type: PaymentMethod.SBP,
        description: subscription.pan,
      };
    }

    return null;
  }

  public getHistory(userId: string): Promise<PaymentHistoryItem[]> {
    return this.paymentRepository.find({
      select: {
        id: true,
        amount: true,
        status: true,
        payment_date: true,
        receipt_url: true,
      },
      where: {
        user_id: userId,
        status: In([
          PaymentStatus.CONFIRMED,
          PaymentStatus.REJECTED,
          PaymentStatus.REFUNDED,
        ]),
      },
      order: {
        payment_date: { direction: 'DESC', nulls: 'LAST' },
        id: 'DESC',
      },
    });
  }
}
