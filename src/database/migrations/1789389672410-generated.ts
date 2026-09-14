import { MigrationInterface, QueryRunner } from 'typeorm';

export class Generated1789389672410 implements MigrationInterface {
  name = 'Generated1789389672410';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "prompt_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "response_id" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "response_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_meta" ALTER COLUMN "prompt_id" SET NOT NULL`,
    );
  }
}
