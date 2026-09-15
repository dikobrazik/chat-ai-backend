import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionSixMonths1789389672412
  implements MigrationInterface
{
  name = 'AddSubscriptionSixMonths1789389672412';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD "six_months" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription" DROP COLUMN "six_months"`,
    );
  }
}
