import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Payment, PaymentStatus } from 'src/entities/Payment';
// import { KassaService } from 'src/kassa/kassa.service';
import { Repository } from 'typeorm';
import { TinkoffKassaService } from './tinkoff-kassa/tinkoff-kassa.service';
import { KassaNotification } from './tinkoff-kassa/types';
// import { OrderTasksService } from './tasks/order-tasks.service';

@Injectable()
export class SubscriptionPaymentNotificationService {
  @InjectRepository(Payment)
  private paymentRepository: Repository<Payment>;

  @Inject(TinkoffKassaService)
  private kassaService: TinkoffKassaService;

  // @Inject(OrderTasksService)
  // private orderTasksService: OrderTasksService;

  public async processNotification(notification: KassaNotification) {
    const isTokenValid = this.kassaService.checkToken(notification);

    if (isTokenValid) {
      // eslint-disable-next-line no-console
      console.log(notification);
      const orderId = notification.OrderId;
      if (notification.Success) {
        if (notification.Status === 'CONFIRMED') {
          // this.orderTasksService.removeCancelationTask(orderId);

          await Promise.all([
            this.paymentRepository.update(
              {
                id: orderId,
              },
              { status: PaymentStatus.CONFIRMED },
            ),
          ]);
        }
      } else {
        // this.orderTasksService.addCancelationTask(orderId);
        // await Promise.all([
        //   this.orderGroupsRepository.update(
        //     { orderId },
        //     { status: OrderStatus.PAYMENT_ERROR },
        //   ),
        //   this.orderOffersRepository.update(
        //     { orderId },
        //     { status: OrderStatus.PAYMENT_ERROR },
        //   ),
        // ]);
      }
    } else {
      new BadRequestException();
    }
  }
}
