import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { In, Repository } from 'typeorm';

export type PaymentHistoryItem = Pick<
  Payment,
  'id' | 'amount' | 'status' | 'payment_date' | 'receipt_url'
>;

@Injectable()
export class PaymentService {
  @InjectRepository(Payment)
  private readonly paymentRepository: Repository<Payment>;

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
