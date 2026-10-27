import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodLinkRequestKey1793009100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" ADD "payment_method_link_request_key" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "subscription" DROP COLUMN "payment_method_link_request_key"',
    );
  }
}
