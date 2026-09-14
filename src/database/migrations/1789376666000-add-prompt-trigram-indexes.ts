import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptTrigramIndexes1789376666000
  implements MigrationInterface
{
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_input_trgm
      ON prompt USING GIN (input gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_response_trgm
      ON prompt USING GIN (response gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_prompt_input_trgm`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_prompt_response_trgm`,
    );
  }
}
