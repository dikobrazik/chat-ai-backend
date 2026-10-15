import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptMetaTokenDefaults1789670000000
  implements MigrationInterface
{
  name = 'AddPromptMetaTokenDefaults1789670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "input_tokens" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "output_tokens" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "thinking_tokens" SET DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "thinking_tokens" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "output_tokens" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "input_tokens" DROP DEFAULT`,
    );
  }
}
