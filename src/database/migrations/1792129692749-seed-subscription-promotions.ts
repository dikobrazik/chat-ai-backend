import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSubscriptionPromotions1792129692749
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "promotion"
        ("id", "name", "type", "reward_type", "reward_value", "max_usages_per_user")
      VALUES
        ('first_subscription', 'Первая подписка', 'NEW_USER', 'FREE_DAYS', 3, 1),
        ('six_months_subscription', 'Подписка на шесть месяцев', 'MANUAL', 'PERCENT_DISCOUNT', 10, NULL)
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep promotions: they may predate this migration or have usage history.
  }
}
