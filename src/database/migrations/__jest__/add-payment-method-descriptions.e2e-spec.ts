import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPaymentMethodDescriptions1793009000000 } from '../1793009000000-AddPaymentMethodDescriptions';

jest.setTimeout(120_000);

describe('AddPaymentMethodDescriptions (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const subscription = {
    id: '00000000-0000-4000-8000-000000000001',
    rebill_id: '123',
    account_token: 'private-token',
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
      migrations: [AddPaymentMethodDescriptions1793009000000],
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

  it('Должен сохранять прежние реквизиты и статус, добавляя неизвестные описания как null', async () => {
    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, tpay_card_mask: null, sbp_bank_name: null },
    ]);
  });

  it('Должен сохранять оба описания независимо и допускать их отсутствие у новых записей', async () => {
    await dataSource.runMigrations();
    await dataSource.query(
      `UPDATE "subscription"
       SET "tpay_card_mask" = $1, "sbp_bank_name" = $2 WHERE "id" = $3`,
      ['**** 0777', 'Тестовый банк', subscription.id],
    );
    await dataSource.query(
      'INSERT INTO "subscription" ("id", "status") VALUES ($1, $2)',
      ['00000000-0000-4000-8000-000000000002', 'pending'],
    );

    await expect(
      dataSource.query(
        'SELECT "tpay_card_mask", "sbp_bank_name" FROM "subscription" ORDER BY "id"',
      ),
    ).resolves.toEqual([
      { tpay_card_mask: '**** 0777', sbp_bank_name: 'Тестовый банк' },
      { tpay_card_mask: null, sbp_bank_name: null },
    ]);
  });

  it('Должен откатываться и применяться повторно без потери реквизитов и статуса', async () => {
    await dataSource.runMigrations();
    await dataSource.undoLastMigration();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([subscription]);

    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      { ...subscription, tpay_card_mask: null, sbp_bank_name: null },
    ]);
  });
});
