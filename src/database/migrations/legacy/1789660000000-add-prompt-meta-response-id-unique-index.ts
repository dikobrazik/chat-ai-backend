import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptMetaResponseIdUniqueIndex1789660000000
  implements MigrationInterface
{
  name = 'AddPromptMetaResponseIdUniqueIndex1789660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "prompt_meta" AS target
      SET
        "prompt_id" = COALESCE(
          target."prompt_id",
          (
            SELECT source."prompt_id"
            FROM "prompt_meta" AS source
            WHERE source."response_id" = target."response_id"
              AND source."prompt_id" IS NOT NULL
            ORDER BY source."id" DESC
            LIMIT 1
          )
        ),
        "input_tokens" = (
          SELECT MAX(source."input_tokens")
          FROM "prompt_meta" AS source
          WHERE source."response_id" = target."response_id"
        ),
        "output_tokens" = (
          SELECT MAX(source."output_tokens")
          FROM "prompt_meta" AS source
          WHERE source."response_id" = target."response_id"
        ),
        "thinking_tokens" = (
          SELECT MAX(source."thinking_tokens")
          FROM "prompt_meta" AS source
          WHERE source."response_id" = target."response_id"
        )
    `);
    await queryRunner.query(`
      DELETE FROM "prompt_meta" AS duplicate
      USING (
        SELECT "response_id", MAX("id") AS "id"
        FROM "prompt_meta"
        GROUP BY "response_id"
      ) AS retained
      WHERE duplicate."response_id" = retained."response_id"
        AND duplicate."id" <> retained."id"
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_prompt_meta_response_id" ON "prompt_meta" ("response_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_prompt_meta_response_id"`);
  }
}
