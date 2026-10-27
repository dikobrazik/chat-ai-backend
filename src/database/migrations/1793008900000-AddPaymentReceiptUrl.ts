import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentReceiptUrl1793008900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "payment" ADD "receipt_url" text');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "payment" DROP COLUMN "receipt_url"');
  }
}
