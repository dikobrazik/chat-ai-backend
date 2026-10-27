import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPaymentReceiptUrl1793008900000 } from '../1793008900000-AddPaymentReceiptUrl';

jest.setTimeout(120_000);

describe('AddPaymentReceiptUrl (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const payment = {
    id: '00000000-0000-4000-8000-000000000001',
    amount: 100,
    status: 'rejected',
    payment_date: null,
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      synchronize: false,
      migrations: [AddPaymentReceiptUrl1793008900000],
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "payment", "migrations"');
    await dataSource.query(`
      CREATE TABLE "payment" (
        "id" uuid PRIMARY KEY,
        "amount" integer NOT NULL,
        "status" varchar NOT NULL,
        "payment_date" timestamptz
      )
    `);
    await dataSource.query(
      'INSERT INTO "payment" ("id", "amount", "status") VALUES ($1, $2, $3)',
      [payment.id, payment.amount, payment.status],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container?.stop();
  });

  it('Должен добавлять nullable-ссылку на чек без изменения существующих платежей и неизвестных дат', async () => {
    await dataSource.runMigrations();

    await expect(dataSource.query('SELECT * FROM "payment"')).resolves.toEqual([
      { ...payment, receipt_url: null },
    ]);
  });

  it('Должен сохранять ссылку и задавать null новым платежам по умолчанию', async () => {
    await dataSource.runMigrations();
    const receiptUrl = 'https://ofd.example.com/receipt/1';
    await dataSource.query(
      'UPDATE "payment" SET "receipt_url" = $1 WHERE "id" = $2',
      [receiptUrl, payment.id],
    );
    await dataSource.query(
      'INSERT INTO "payment" ("id", "amount", "status") VALUES ($1, $2, $3)',
      ['00000000-0000-4000-8000-000000000002', 1_000, 'confirmed'],
    );

    await expect(
      dataSource.query('SELECT "receipt_url" FROM "payment" ORDER BY "id"'),
    ).resolves.toEqual([{ receipt_url: receiptUrl }, { receipt_url: null }]);
  });

  it('Должен откатываться и применяться повторно без потери платежей', async () => {
    await dataSource.runMigrations();
    await dataSource.undoLastMigration();

    await expect(dataSource.query('SELECT * FROM "payment"')).resolves.toEqual([
      payment,
    ]);

    await dataSource.runMigrations();

    await expect(dataSource.query('SELECT * FROM "payment"')).resolves.toEqual([
      { ...payment, receipt_url: null },
    ]);
  });
});
