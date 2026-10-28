import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPaymentMethodDeletedAt1793009200000 } from '../1793009200000-AddPaymentMethodDeletedAt';

jest.setTimeout(120_000);

describe('AddPaymentMethodDeletedAt (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const subscription = { id: 1, rebill_id: '123', status: 'active' };

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
      migrations: [AddPaymentMethodDeletedAt1793009200000],
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "subscription", "migrations"');
    await dataSource.query(`
      CREATE TABLE "subscription" (
        "id" integer PRIMARY KEY,
        "rebill_id" bigint,
        "status" varchar NOT NULL
      )
    `);
    await dataSource.query('INSERT INTO "subscription" VALUES ($1, $2, $3)', [
      subscription.id,
      subscription.rebill_id,
      subscription.status,
    ]);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('Должен добавлять nullable-время удаления без изменения существующих данных', async () => {
    await dataSource.runMigrations();
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([{ ...subscription, payment_method_deleted_at: null }]);
  });

  it('Должен сохранять время удаления с часовым поясом', async () => {
    await dataSource.runMigrations();
    await dataSource.query(
      'UPDATE "subscription" SET "payment_method_deleted_at" = $1 WHERE "id" = $2',
      ['2026-10-28T16:05:00+03:00', subscription.id],
    );
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([
      {
        ...subscription,
        payment_method_deleted_at: new Date('2026-10-28T13:05:00Z'),
      },
    ]);
  });

  it('Должен откатываться и применяться повторно без потери исходных данных', async () => {
    await dataSource.runMigrations();
    await dataSource.undoLastMigration();
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([subscription]);
    await dataSource.runMigrations();
    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([{ ...subscription, payment_method_deleted_at: null }]);
  });
});
