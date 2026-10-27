import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodDescriptions1793009000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription"
      ADD "tpay_card_mask" text,
      ADD "sbp_bank_name" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription"
      DROP COLUMN "sbp_bank_name",
      DROP COLUMN "tpay_card_mask"
    `);
  }
}
