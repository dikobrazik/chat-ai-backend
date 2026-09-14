import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPromptTrigramIndexes1789376666000 } from 'src/database/migrations/1789376666000-add-prompt-trigram-indexes';

jest.setTimeout(120_000);

describe('Миграция GIN-индексов поиска промптов', () => {
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
      migrations: [AddPromptTrigramIndexes1789376666000],
    });
    await dataSource.initialize();
    await dataSource.query(`
      CREATE TABLE prompt (
        id uuid PRIMARY KEY,
        input varchar NOT NULL,
        response varchar NOT NULL
      )
    `);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }

    if (container) {
      await container.stop();
    }
  });

  it('Должен создавать GIN-индексы для подстрочного поиска в input и response', async () => {
    await dataSource.runMigrations({ transaction: 'none' });

    const indexes = await dataSource.query<
      { indexname: string; indexdef: string }[]
    >(
      `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prompt'
          AND indexname IN ('idx_prompt_input_trgm', 'idx_prompt_response_trgm')
        ORDER BY indexname
      `,
    );

    expect(indexes).toEqual([
      expect.objectContaining({
        indexname: 'idx_prompt_input_trgm',
        indexdef: expect.stringContaining('gin_trgm_ops'),
      }),
      expect.objectContaining({
        indexname: 'idx_prompt_response_trgm',
        indexdef: expect.stringContaining('gin_trgm_ops'),
      }),
    ]);
  });
});
