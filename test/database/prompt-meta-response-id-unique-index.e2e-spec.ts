import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPromptMetaResponseIdUniqueIndex1789660000000 } from 'src/database/migrations/1789660000000-add-prompt-meta-response-id-unique-index';
import { AddPromptMetaTokenDefaults1789670000000 } from 'src/database/migrations/1789670000000-add-prompt-meta-token-defaults';

jest.setTimeout(120_000);

describe('Миграция уникального индекса response_id метаданных промпта', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      migrations: [
        AddPromptMetaResponseIdUniqueIndex1789660000000,
        AddPromptMetaTokenDefaults1789670000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.query(`
      CREATE TABLE "prompt_meta" (
        "id" SERIAL PRIMARY KEY,
        "prompt_id" uuid,
        "response_id" varchar NOT NULL,
        "input_tokens" integer NOT NULL,
        "output_tokens" integer NOT NULL,
        "thinking_tokens" integer NOT NULL
      )
    `);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  it('Должен удалить старые дубли и обновить prompt_id без потери метрик', async () => {
    await dataSource.query(`
      INSERT INTO "prompt_meta" (
        "prompt_id",
        "response_id",
        "input_tokens",
        "output_tokens",
        "thinking_tokens"
      )
      VALUES
        (NULL, 'response-id', 100, 200, 50),
        ('53453b1a-654b-435c-bbba-3f190ef5b026', 'response-id', 10, 20, 5)
    `);

    await dataSource.runMigrations();

    await expect(
      dataSource.query(`
        INSERT INTO "prompt_meta" ("prompt_id", "response_id")
        VALUES ('53453b1a-654b-435c-bbba-3f190ef5b026', 'response-id')
        ON CONFLICT ("response_id") DO UPDATE
        SET "prompt_id" = EXCLUDED."prompt_id"
      `),
    ).resolves.toBeDefined();

    const rows = await dataSource.query<
      {
        prompt_id: string;
        input_tokens: number;
        output_tokens: number;
        thinking_tokens: number;
      }[]
    >(`SELECT * FROM "prompt_meta" WHERE "response_id" = 'response-id'`);

    expect(rows).toEqual([
      expect.objectContaining({
        prompt_id: '53453b1a-654b-435c-bbba-3f190ef5b026',
        input_tokens: 100,
        output_tokens: 200,
        thinking_tokens: 50,
      }),
    ]);
  });
});
