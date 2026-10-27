import 'reflect-metadata';

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddSubscriptionTrialFlag1793008800000 } from '../1793008800000-AddSubscriptionTrialFlag';

jest.setTimeout(120_000);

describe('AddSubscriptionTrialFlag (интеграционный тест)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  const subscription = {
    id: '00000000-0000-4000-8000-000000000001',
    plan: 'plus',
    status: 'active',
    current_period_end: new Date('2026-10-11T08:00:00.000Z'),
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
      migrations: [AddSubscriptionTrialFlag1793008800000],
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.query('DROP TABLE IF EXISTS "subscription", "migrations"');
    await dataSource.query(`
      CREATE TABLE "subscription" (
        "id" uuid PRIMARY KEY,
        "plan" varchar NOT NULL,
        "status" varchar NOT NULL,
        "current_period_end" timestamptz
      )
    `);
    await dataSource.query(
      `INSERT INTO "subscription" ("id", "plan", "status", "current_period_end")
       VALUES ($1, $2, $3, $4)`,
      [
        subscription.id,
        subscription.plan,
        subscription.status,
        subscription.current_period_end,
      ],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container?.stop();
  });

  it('Должен добавлять непробный период существующим подпискам без изменения остальных данных', async () => {
    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([{ ...subscription, is_trial: false }]);
  });

  it('Должен задавать false новым подпискам по умолчанию и запрещать null', async () => {
    await dataSource.runMigrations();
    const newId = '00000000-0000-4000-8000-000000000002';

    await dataSource.query(
      `INSERT INTO "subscription" ("id", "plan", "status")
       VALUES ($1, $2, $3)`,
      [newId, 'pro', 'active'],
    );
    await expect(
      dataSource.query(
        'SELECT "is_trial" FROM "subscription" WHERE "id" = $1',
        [newId],
      ),
    ).resolves.toEqual([{ is_trial: false }]);
    await expect(
      dataSource.query(
        'UPDATE "subscription" SET "is_trial" = NULL WHERE "id" = $1',
        [newId],
      ),
    ).rejects.toMatchObject({ driverError: { code: '23502' } });
  });

  it('Должен откатываться и применяться повторно без потери подписок', async () => {
    await dataSource.runMigrations();
    await dataSource.query('UPDATE "subscription" SET "is_trial" = true');

    await dataSource.undoLastMigration();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([subscription]);

    await dataSource.runMigrations();

    await expect(
      dataSource.query('SELECT * FROM "subscription"'),
    ).resolves.toEqual([{ ...subscription, is_trial: false }]);
  });
});
