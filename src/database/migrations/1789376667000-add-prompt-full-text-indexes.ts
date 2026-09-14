import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptFullTextIndexes1789376667000
  implements MigrationInterface
{
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_input_fts
      ON prompt USING GIN (to_tsvector('russian', input))
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_response_fts
      ON prompt USING GIN (to_tsvector('russian', response))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_prompt_input_fts`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_prompt_response_fts`,
    );
  }
}
