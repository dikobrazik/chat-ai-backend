import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailedSubscriptionStatus1789389672413
  implements MigrationInterface
{
  name = 'AddFailedSubscriptionStatus1789389672413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "subscription_status_enum" ADD VALUE IF NOT EXISTS 'failed'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" TYPE character varying USING "status"::text`,
    );
    await queryRunner.query(`DROP TYPE "subscription_status_enum"`);
    await queryRunner.query(
      `CREATE TYPE "subscription_status_enum" AS ENUM('pending', 'active', 'canceled', 'expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" TYPE "subscription_status_enum" USING "status"::"subscription_status_enum"`,
    );
  }
}
