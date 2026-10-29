import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionPan1793009300000 implements MigrationInterface {
  public transaction = true;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" RENAME COLUMN "tpay_card_mask" TO "pan"',
    );
    await queryRunner.query(
      'ALTER TABLE "subscription" DROP COLUMN "sbp_bank_name"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" RENAME COLUMN "pan" TO "tpay_card_mask"',
    );
    await queryRunner.query(
      'ALTER TABLE "subscription" ADD "sbp_bank_name" text',
    );
  }
}
