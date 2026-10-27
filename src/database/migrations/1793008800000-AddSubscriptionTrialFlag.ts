import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionTrialFlag1793008800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" ADD "is_trial" boolean NOT NULL DEFAULT false',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" DROP COLUMN "is_trial"',
    );
  }
}
