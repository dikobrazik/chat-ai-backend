import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOauthProviders1789389672414 implements MigrationInterface {
  name = 'AddOauthProviders1789389672414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "oauth_account_provider_enum" ADD VALUE IF NOT EXISTS 'vk'`,
    );
    await queryRunner.query(
      `ALTER TYPE "oauth_account_provider_enum" ADD VALUE IF NOT EXISTS 'mailru'`,
    );
    await queryRunner.query(
      `ALTER TYPE "oauth_account_provider_enum" ADD VALUE IF NOT EXISTS 'ok'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_account" ALTER COLUMN "provider" TYPE character varying USING "provider"::text`,
    );
    await queryRunner.query(`DROP TYPE "oauth_account_provider_enum"`);
    await queryRunner.query(
      `CREATE TYPE "oauth_account_provider_enum" AS ENUM('local', 'yandex', 'google')`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_account" ALTER COLUMN "provider" TYPE "oauth_account_provider_enum" USING "provider"::"oauth_account_provider_enum"`,
    );
  }
}
