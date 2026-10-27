import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, type Mocked } from '@suites/unit';
import { Payment, PaymentStatus } from 'src/entities/Payment';
import { In, type Repository } from 'typeorm';
import { PaymentService } from '../payment.service';

describe(PaymentService.name, () => {
  let service: PaymentService;
  let repository: Mocked<Repository<Payment>>;
  const repositoryToken = getRepositoryToken(Payment) as string;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(PaymentService)
      .mock(repositoryToken)
      .impl(() => ({ find: jest.fn() }))
      .compile();
    service = unit;
    repository = unitRef.get(repositoryToken);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('Должен запрашивать только публичные поля завершённых платежей текущего пользователя', async () => {
    repository.find.mockResolvedValueOnce([]);

    await expect(service.getHistory('user-id')).resolves.toEqual([]);

    expect(repository.find).toHaveBeenCalledWith({
      select: {
        id: true,
        amount: true,
        status: true,
        payment_date: true,
        receipt_url: true,
      },
      where: {
        user_id: 'user-id',
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
  });

  it('Должен сохранять неизвестные даты и отсутствующие чеки без подстановки значений', async () => {
    const payments = [
      Object.assign(new Payment(), {
        id: 'payment-id',
        amount: 100,
        status: PaymentStatus.REJECTED,
        payment_date: null,
        receipt_url: null,
      }),
    ];
    repository.find.mockResolvedValueOnce(payments);

    await expect(service.getHistory('user-id')).resolves.toEqual(payments);
  });
});
