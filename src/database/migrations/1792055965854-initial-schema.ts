import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1792055965854 implements MigrationInterface {
  name = 'InitialSchema1792055965854';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user')) {
      return;
    }

    await queryRunner.query(
      `CREATE TYPE "public"."subscription_plan_enum" AS ENUM('base', 'plus', 'pro')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status_enum" AS ENUM('pending', 'active', 'canceled', 'renewing', 'failed', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "plan" "public"."subscription_plan_enum" NOT NULL, "status" "public"."subscription_status_enum" NOT NULL, "current_period_start" TIMESTAMP WITH TIME ZONE, "current_period_end" TIMESTAMP WITH TIME ZONE, "six_months" boolean NOT NULL DEFAULT false, "rebill_id" bigint, "account_token" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_940d49a105d50bbd616be54001" UNIQUE ("user_id"), CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum" AS ENUM('guest', 'active', 'verified', 'subscription_base', 'subscription_plus', 'subscription_pro')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying, "name" character varying, "passwordHash" character varying, "emailVerified" boolean NOT NULL DEFAULT false, "mailing_consent" boolean NOT NULL DEFAULT false, "photo" character varying, "status" "public"."user_status_enum" NOT NULL DEFAULT 'guest', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "model_provider" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_7e2ae9b4ba3973e7d2cd3cf848f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."model_available_for_status_enum" AS ENUM('guest', 'active', 'verified', 'subscription_base', 'subscription_plus', 'subscription_pro')`,
    );
    await queryRunner.query(
      `CREATE TABLE "model" ("id" SERIAL NOT NULL, "provider_id" integer NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "for_image" boolean NOT NULL DEFAULT false, "available_for_status" "public"."model_available_for_status_enum" NOT NULL, CONSTRAINT "PK_d6df271bba301d5cc79462912a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL DEFAULT '', "external_chat_id" character varying, "is_public" boolean NOT NULL DEFAULT false, "is_pinned" boolean DEFAULT false, "user_id" uuid NOT NULL, "model_id" integer NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "file_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "size" integer NOT NULL, "type" character varying NOT NULL, "bucket" character varying NOT NULL, "bucket_key" character varying NOT NULL, "owner_id" uuid NOT NULL, "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d8375e0b2592310864d2b4974b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oauth_account_provider_enum" AS ENUM('local', 'yandex', 'google', 'vk', 'mailru', 'ok')`,
    );
    await queryRunner.query(
      `CREATE TABLE "oauth_account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "provider" "public"."oauth_account_provider_enum" NOT NULL, "provider_user_id" character varying NOT NULL, "access_token" character varying, "refresh_token" character varying, "expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "REL_e355ddb0b69b083cbf253345d1" UNIQUE ("user_id"), CONSTRAINT "PK_01ec7d2a8273dcaaed3dd10a4fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_status_enum" AS ENUM('new', 'form_shown', 'confirmed', 'refunded', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "subscription_id" uuid NOT NULL, "external_payment_id" character varying, "amount" integer NOT NULL, "status" "public"."payment_status_enum" NOT NULL, "payment_date" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prompt_file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_id" uuid NOT NULL, "prompt_id" uuid NOT NULL, CONSTRAINT "REL_4d6c3cb8668b51b4d96dc812a5" UNIQUE ("file_id"), CONSTRAINT "PK_77c4c2991228d0825cac302a18e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prompt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chat_id" uuid NOT NULL, "input" character varying NOT NULL, "response_id" character varying, "response" character varying NOT NULL, "is_image" boolean, "is_public" boolean, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d8e3aa07a95560a445ad50fb931" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prompt_meta" ("id" SERIAL NOT NULL, "prompt_id" uuid, "response_id" character varying NOT NULL, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "thinking_tokens" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_4d517684ef83d14e8e4ebd00360" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_prompt_meta_response_id" ON "prompt_meta" ("response_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."promotion_type_enum" AS ENUM('PROMO_CODE', 'NEW_USER', 'REFERRAL', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."promotion_reward_type_enum" AS ENUM('FREE_DAYS', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "promotion" ("id" character varying NOT NULL, "name" character varying NOT NULL, "code" character varying, "type" "public"."promotion_type_enum" NOT NULL DEFAULT 'MANUAL', "reward_type" "public"."promotion_reward_type_enum" NOT NULL, "reward_value" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "ends_at" TIMESTAMP WITH TIME ZONE, "max_usages" integer, "max_usages_per_user" integer, CONSTRAINT "PK_fab3630e0789a2002f1cadb7d38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" character varying, "device_id" character varying, "os" character varying, "browser" character varying, "location" character varying, "revoked" boolean NOT NULL DEFAULT false, "expires_at" TIMESTAMP WITH TIME ZONE, "last_active_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_session_user_device" ON "session" ("user_id", "device_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_promotion_status_enum" AS ENUM('ACTIVE', 'EXPIRED', 'CONSUMED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_promotion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "promotion_id" character varying NOT NULL, "payment_id" uuid, "activated_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP, "status" "public"."user_promotion_status_enum" NOT NULL DEFAULT 'ACTIVE', CONSTRAINT "PK_a384c712c001b8498406ae9a86c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_notification_type_enum" AS ENUM('charge_reminder')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_notification_status_enum" AS ENUM('processing', 'sent', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscription_notification" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscription_id" uuid NOT NULL, "type" "public"."subscription_notification_type_enum" NOT NULL, "period_end" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."subscription_notification_status_enum" NOT NULL DEFAULT 'processing', "attempts" integer NOT NULL DEFAULT '1', "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f3a6c9ab9aca243acd8ee7b7491" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscription_notification_subscription_type_period" ON "subscription_notification" ("subscription_id", "type", "period_end") `,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_940d49a105d50bbd616be540013" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "model" ADD CONSTRAINT "FK_7e2ae9b4ba3973e7d2cd3cf848f" FOREIGN KEY ("provider_id") REFERENCES "model_provider"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "FK_15d83eb496fd7bec7368b30dbf3" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "FK_aa10e398bab76d17ec7aca4d03a" FOREIGN KEY ("model_id") REFERENCES "model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_entity" ADD CONSTRAINT "FK_23153c0a2f86b8350731f52d075" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_account" ADD CONSTRAINT "FK_e355ddb0b69b083cbf253345d1c" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ADD CONSTRAINT "FK_c66c60a17b56ec882fcd8ec770b" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ADD CONSTRAINT "FK_c3d0d14588512c4eb2d86b4b954" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_file" ADD CONSTRAINT "FK_4d6c3cb8668b51b4d96dc812a51" FOREIGN KEY ("file_id") REFERENCES "file_entity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt_file" ADD CONSTRAINT "FK_b33329de1619579db4e32a112a6" FOREIGN KEY ("prompt_id") REFERENCES "prompt"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prompt" ADD CONSTRAINT "FK_6cd0878008dfdffad9cbcb2e554" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_30e98e8746699fb9af235410aff" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_promotion" ADD CONSTRAINT "FK_0d1e3846818df36b838bcefd049" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_promotion" ADD CONSTRAINT "FK_f2364e1453e4d3b00cb87b29ec3" FOREIGN KEY ("promotion_id") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_promotion" ADD CONSTRAINT "FK_234868076eeaab11baea2a8ca3c" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription_notification" ADD CONSTRAINT "FK_39c40000808170afac34b881e79" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prompt_input_trgm" ON "prompt" USING GIN ("input" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prompt_response_trgm" ON "prompt" USING GIN ("response" gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prompt_input_fts" ON "prompt" USING GIN (to_tsvector('russian', "input"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prompt_response_fts" ON "prompt" USING GIN (to_tsvector('russian', "response"))`,
    );
  }

  public async down(): Promise<void> {
    throw new Error('Initial schema migration cannot be reverted safely');
  }
}
