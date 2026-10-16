import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Model } from 'src/entities/Model';
import { ModelProvider } from 'src/entities/ModelProvider';
import { Promotion } from 'src/entities/Promotion';
import { DataSource } from 'typeorm';
import { SEED_MODELS } from './seeds/models';
import { SEED_PROMOTIONS } from './seeds/promotions/promotions.seed';
import { SEED_PROVIDERS } from './seeds/providers/providers.seed';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  @Inject(DataSource)
  private readonly dataSource: DataSource;

  private readonly logger = new Logger(DatabaseSeedService.name);

  async onModuleInit(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `LOCK TABLE "model_provider", "model", "promotion" IN SHARE ROW EXCLUSIVE MODE`,
      );
      const existingProviders = await manager.find(ModelProvider);
      for (const provider of SEED_PROVIDERS) {
        const conflict = existingProviders.find(
          (existing) =>
            existing.name === provider.name && existing.id !== provider.id,
        );
        if (conflict) {
          throw new Error(
            `Model provider mapping conflict: expected ${provider.id}=${provider.name}, found ${conflict.id}=${conflict.name}`,
          );
        }
      }

      // Insert fixed IDs explicitly; TypeORM generates IDs for serial columns.
      for (const provider of SEED_PROVIDERS) {
        await manager.query(
          `INSERT INTO "model_provider" ("id", "name") VALUES ($1, $2)
           ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"
           WHERE "model_provider"."name" IS DISTINCT FROM EXCLUDED."name"`,
          [provider.id, provider.name],
        );
      }
      // Per-record upserts leave fields omitted from that seed untouched.
      for (const model of SEED_MODELS) {
        await manager.upsert(Model, model, {
          conflictPaths: ['id'],
          skipUpdateIfNoValuesChanged: true,
        });
      }
      for (const promotion of SEED_PROMOTIONS) {
        await manager.upsert(Promotion, promotion, {
          conflictPaths: ['id'],
          skipUpdateIfNoValuesChanged: true,
        });
      }
      await manager.query(`
        SELECT setval(
          pg_get_serial_sequence('model_provider', 'id'),
          GREATEST(
            (SELECT MAX("id") FROM "model_provider"),
            pg_sequence_last_value(pg_get_serial_sequence('model_provider', 'id')::regclass)
          ),
          TRUE
        )
      `);

      // TypeORM cannot synchronize PostgreSQL operator classes or expressions.
      await manager.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await manager.query(`
        CREATE INDEX IF NOT EXISTS "idx_prompt_input_trgm"
        ON "prompt" USING GIN ("input" gin_trgm_ops)
      `);
      await manager.query(`
        CREATE INDEX IF NOT EXISTS "idx_prompt_response_trgm"
        ON "prompt" USING GIN ("response" gin_trgm_ops)
      `);
      await manager.query(`
        CREATE INDEX IF NOT EXISTS "idx_prompt_input_fts"
        ON "prompt" USING GIN (to_tsvector('russian', "input"))
      `);
      await manager.query(`
        CREATE INDEX IF NOT EXISTS "idx_prompt_response_fts"
        ON "prompt" USING GIN (to_tsvector('russian', "response"))
      `);
    });
    this.logger.log('Database seed completed');
  }
}
