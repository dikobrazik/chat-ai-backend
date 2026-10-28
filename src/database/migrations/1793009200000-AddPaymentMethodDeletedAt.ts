import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodDeletedAt1793009200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" ADD "payment_method_deleted_at" timestamptz',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" DROP COLUMN "payment_method_deleted_at"',
    );
  }
}
