import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPromotionPayment1789389672411
  implements MigrationInterface
{
  name = 'AddUserPromotionPayment1789389672411';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_promotion" ADD "payment_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_promotion" ADD CONSTRAINT "FK_user_promotion_payment" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_promotion" DROP CONSTRAINT "FK_user_promotion_payment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_promotion" DROP COLUMN "payment_id"`,
    );
  }
}
