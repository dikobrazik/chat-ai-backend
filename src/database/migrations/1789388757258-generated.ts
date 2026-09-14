import { MigrationInterface, QueryRunner } from 'typeorm';

export class Generated1789388757258 implements MigrationInterface {
  name = 'Generated1789388757258';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ADD "response_id" character varying`,
    );
    await queryRunner.query(
      `UPDATE "prompt_meta" SET "response_id" = "prompt_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ADD "response_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" DROP COLUMN "prompt_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ADD "prompt_id" uuid NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" DROP COLUMN "prompt_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ADD "prompt_id" character varying`,
    );
    await queryRunner.query(
      `UPDATE "prompt_meta" SET "prompt_id" = "response_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ADD "prompt_id" character varying NOT_NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" DROP COLUMN "response_id"`,
    );
  }
}
