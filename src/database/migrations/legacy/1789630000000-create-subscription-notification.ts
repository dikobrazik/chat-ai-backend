import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionNotification1789630000000
  implements MigrationInterface
{
  name = 'CreateSubscriptionNotification1789630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "subscription_notification_type_enum" AS ENUM('charge_reminder')`,
    );
    await queryRunner.query(
      `CREATE TYPE "subscription_notification_status_enum" AS ENUM('processing', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_notification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "type" "subscription_notification_type_enum" NOT NULL, "period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "subscription_notification_status_enum" NOT NULL DEFAULT 'processing', "attempts" integer NOT NULL DEFAULT '1', "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_subscription_notification" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscription_notification_subscription_type_period" ON "subscription_notification" ("subscription_id", "type", "period_end")`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_notification" ADD CONSTRAINT "FK_subscription_notification_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscription_notification" DROP CONSTRAINT "FK_subscription_notification_subscription"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_subscription_notification_subscription_type_period"`,
    );
    await queryRunner.query(`DROP TABLE "subscription_notification"`);
    await queryRunner.query(
      `DROP TYPE "subscription_notification_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "subscription_notification_type_enum"`);
  }
}
