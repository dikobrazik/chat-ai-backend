import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AddPromptFullTextIndexes1789376667000 } from 'src/database/migrations/1789376667000-add-prompt-full-text-indexes';

jest.setTimeout(120_000);

describe('Миграция полнотекстовых индексов поиска промптов', () => {
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
      migrations: [AddPromptFullTextIndexes1789376667000],
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

  it('Должен создавать GIN-индексы для полнотекстового поиска в input и response', async () => {
    await dataSource.runMigrations({ transaction: 'none' });

    const indexes = await dataSource.query<
      { indexname: string; indexdef: string }[]
    >(
      `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'prompt'
          AND indexname IN ('idx_prompt_input_fts', 'idx_prompt_response_fts')
        ORDER BY indexname
      `,
    );

    expect(indexes).toEqual([
      expect.objectContaining({
        indexname: 'idx_prompt_input_fts',
        indexdef: expect.stringContaining('to_tsvector'),
      }),
      expect.objectContaining({
        indexname: 'idx_prompt_response_fts',
        indexdef: expect.stringContaining('to_tsvector'),
      }),
    ]);
  });
});
