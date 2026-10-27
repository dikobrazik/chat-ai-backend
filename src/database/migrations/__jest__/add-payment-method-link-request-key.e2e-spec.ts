import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPaymentMethodLinkRequestKey1793009100000 } from '../1793009100000-AddPaymentMethodLinkRequestKey';

jest.setTimeout(120_000);

describe('AddPaymentMethodLinkRequestKey (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const subscription = {
    id: '00000000-0000-4000-8000-000000000001',
    rebill_id: '123',
    account_token: 'old-token',
    status: 'canceled',
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
      migrations: [AddPaymentMethodLinkRequestKey1793009100000],
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "subscription", "migrations"');
    await dataSource.query(`
      CREATE TABLE "subscription" (
        "id" uuid PRIMARY KEY,
        "rebill_id" bigint,
        "account_token" varchar,
        "status" varchar NOT NULL
      )
    `);
    await dataSource.query(
      `INSERT INTO "subscription" ("id", "rebill_id", "account_token", "status")
       VALUES ($1, $2, $3, $4)`,
      [
        subscription.id,
        subscription.rebill_id,
        subscription.account_token,
        subscription.status,
      ],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container?.stop();
  });

  it('Должен добавлять nullable-ключ без изменения статуса и реквизитов', async () => {
    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, payment_method_link_request_key: null },
    ]);
  });

  it('Должен сохранять ключ и очищать его без изменения реквизитов', async () => {
    await dataSource.runMigrations();
    await dataSource.query(
      'UPDATE "subscription" SET "payment_method_link_request_key" = $1 WHERE "id" = $2',
      ['request-key', subscription.id],
    );
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, payment_method_link_request_key: 'request-key' },
    ]);
    await dataSource.query(
      'UPDATE "subscription" SET "payment_method_link_request_key" = NULL',
    );
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, payment_method_link_request_key: null },
    ]);
  });

  it('Должен откатываться и применяться повторно без потери реквизитов', async () => {
    await dataSource.runMigrations();
    await dataSource.undoLastMigration();
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([subscription]);
    await dataSource.runMigrations();
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, payment_method_link_request_key: null },
    ]);
  });
});
