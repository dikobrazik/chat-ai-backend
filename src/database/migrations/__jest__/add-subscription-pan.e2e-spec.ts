import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddSubscriptionPan1793009300000 } from '../1793009300000-AddSubscriptionPan';

jest.setTimeout(120_000);

describe('AddSubscriptionPan (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const cardSubscription = {
    id: '00000000-0000-4000-8000-000000000001',
    rebill_id: '123',
    account_token: null,
    tpay_card_mask: '**** 0777',
    sbp_bank_name: null,
  };
  const sbpSubscription = {
    id: '00000000-0000-4000-8000-000000000002',
    rebill_id: null,
    account_token: 'test-account-token',
    tpay_card_mask: null,
    sbp_bank_name: 'Тестовый банк',
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
      migrationsTransactionMode: 'none',
      migrations: [AddSubscriptionPan1793009300000],
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
        "tpay_card_mask" text,
        "sbp_bank_name" text
      )
    `);
    for (const subscription of [cardSubscription, sbpSubscription]) {
      await dataSource.query(
        `INSERT INTO "subscription"
          ("id", "rebill_id", "account_token", "tpay_card_mask", "sbp_bank_name")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          subscription.id,
          subscription.rebill_id,
          subscription.account_token,
          subscription.tpay_card_mask,
          subscription.sbp_bank_name,
        ],
      );
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container?.stop();
  });

  it('Должен перенести маски карт, удалить прежние поля и не переносить названия банков в pan', async () => {
    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription" ORDER BY "id"'),
    ).resolves.toEqual([
      {
        id: cardSubscription.id,
        rebill_id: cardSubscription.rebill_id,
        account_token: null,
        pan: cardSubscription.tpay_card_mask,
      },
      {
        id: sbpSubscription.id,
        rebill_id: null,
        account_token: sbpSubscription.account_token,
        pan: null,
      },
    ]);
  });

  it('Должен сохранять маски карт и телефонов при откате и повторном применении, восстанавливая название банка как null', async () => {
    await dataSource.runMigrations();
    const phoneMask = '+7(900)***-**-12';
    await dataSource.query(
      'UPDATE "subscription" SET "pan" = $1 WHERE "id" = $2',
      [phoneMask, sbpSubscription.id],
    );
    await dataSource.undoLastMigration();

    await expect(
      dataSource.query('SELECT * FROM "subscription" ORDER BY "id"'),
    ).resolves.toEqual([
      cardSubscription,
      {
        ...sbpSubscription,
        tpay_card_mask: phoneMask,
        sbp_bank_name: null,
      },
    ]);

    await dataSource.runMigrations();
    await expect(
      dataSource.query('SELECT "pan" FROM "subscription" ORDER BY "id"'),
    ).resolves.toEqual([
      { pan: cardSubscription.tpay_card_mask },
      { pan: phoneMask },
    ]);
  });
});
