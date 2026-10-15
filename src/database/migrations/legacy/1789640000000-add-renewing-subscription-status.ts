import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRenewingSubscriptionStatus1789640000000
  implements MigrationInterface
{
  name = 'AddRenewingSubscriptionStatus1789640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "subscription_status_enum" ADD VALUE IF NOT EXISTS 'renewing'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" TYPE character varying USING "status"::text`,
    );
    await queryRunner.query(`DROP TYPE "subscription_status_enum"`);
    await queryRunner.query(
      `CREATE TYPE "subscription_status_enum" AS ENUM('pending', 'active', 'canceled', 'failed', 'expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ALTER COLUMN "status" TYPE "subscription_status_enum" USING "status"::"subscription_status_enum"`,
    );
  }
}
