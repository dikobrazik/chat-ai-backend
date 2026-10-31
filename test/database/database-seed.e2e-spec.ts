import 'reflect-metadata';

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DatabaseSeedService } from 'src/database/database-seed.service';
import { SEED_MODELS } from 'src/database/seeds/models';
import { ALIBABA_MODELS } from 'src/database/seeds/models/alibaba/models.seed';
import { SEED_PROMOTIONS } from 'src/database/seeds/promotions/promotions.seed';
import { SEED_PROVIDERS } from 'src/database/seeds/providers/providers.seed';
import { Chat } from 'src/entities/Chat';
import { FileEntity } from 'src/entities/File';
import { Model } from 'src/entities/Model';
import { ModelProvider } from 'src/entities/ModelProvider';
import { Prompt } from 'src/entities/Prompt';
import { PromptFile } from 'src/entities/PromptFile';
import { PromptMeta } from 'src/entities/PromptMeta';
import {
  Promotion,
  PromotionRewardType,
  PromotionType,
} from 'src/entities/Promotion';
import { User, UserStatus } from 'src/entities/User';
import {
  FIRST_SUBSCRIPTION_PROMOTION_ID,
  SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
} from 'src/promotion/constants';
import { DataSource, Repository } from 'typeorm';

jest.setTimeout(120_000);

describe('Автоматическое заполнение БД', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let seed: DatabaseSeedService;
  let models: Repository<Model>;
  let providers: Repository<ModelProvider>;
  let promotions: Repository<Promotion>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [
            ModelProvider,
            Model,
            Promotion,
            User,
            Chat,
            Prompt,
            PromptFile,
            FileEntity,
            PromptMeta,
          ],
          synchronize: true,
          dropSchema: true,
        }),
      ],
      providers: [DatabaseSeedService],
    }).compile();
    dataSource = moduleRef.get(DataSource);
    seed = moduleRef.get(DatabaseSeedService);
    models = dataSource.getRepository(Model);
    providers = dataSource.getRepository(ModelProvider);
    promotions = dataSource.getRepository(Promotion);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it('При запуске создаёт провайдеров, модели и акции из seed', async () => {
    await moduleRef.init();

    expect(await providers.find({ order: { id: 'ASC' } })).toEqual([
      { id: 1, name: 'openai' },
      { id: 2, name: 'google' },
      { id: 3, name: 'grok' },
      { id: 4, name: 'deepseek' },
      { id: 5, name: 'claude' },
      { id: 6, name: 'alibaba' },
    ]);
    const catalog = await models.find();
    expect(catalog).toHaveLength(SEED_MODELS.length);
    expect(
      Object.fromEntries(
        catalog.map((model) => [model.id, model.available_for_status]),
      ),
    ).toEqual({
      'openai:gpt-5.4-mini': UserStatus.ACTIVE,
      'openai:gpt-5.4': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-6-astra': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-6.1-sol': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-6-luna': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-image-2.5-sunburst': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-image-2.5-flare': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-4o': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-4o-mini': UserStatus.GUEST,
      'openai:gpt-image-1-mini': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-6-sol': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.6-sol': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.6-terra': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.6-luna': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.5': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.5-pro': UserStatus.SUBSCRIPTION_PRO,
      'openai:gpt-5.4-nano': UserStatus.ACTIVE,
      'openai:gpt-5.2': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5.1': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-5-mini': UserStatus.ACTIVE,
      'openai:gpt-5': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-4.1-mini': UserStatus.ACTIVE,
      'openai:gpt-4.1-nano': UserStatus.ACTIVE,
      'openai:o3-mini': UserStatus.ACTIVE,
      'openai:gpt-image-2': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-image-1.5': UserStatus.SUBSCRIPTION_PLUS,
      'openai:gpt-image-1': UserStatus.SUBSCRIPTION_PLUS,
      'openai:chatgpt-image-latest': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3.8-flash': UserStatus.ACTIVE,
      'google:gemini-4-argon': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3.6-flash': UserStatus.ACTIVE,
      'google:gemini-3.5-flash-lite': UserStatus.ACTIVE,
      'google:gemini-3.1-flash-lite': UserStatus.GUEST,
      'google:gemini-nano-banana-2.1': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3.1-flash-image': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3.1-flash-lite-image': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3.1-pro-preview': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-3-flash-preview': UserStatus.ACTIVE,
      'google:gemini-2.5-flash': UserStatus.ACTIVE,
      'google:gemini-2.5-flash-image': UserStatus.SUBSCRIPTION_PLUS,
      'google:gemini-2.5-flash-lite': UserStatus.ACTIVE,
      'google:gemini-2.5-pro': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-4.7': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-4.6': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-4.5': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-4.3': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-imagine-image-2.0': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-imagine-image': UserStatus.SUBSCRIPTION_PLUS,
      'grok:grok-imagine-image-quality': UserStatus.SUBSCRIPTION_PLUS,
      'deepseek:deepseek-flash': UserStatus.GUEST,
      'deepseek:deepseek-v4-pro': UserStatus.SUBSCRIPTION_PLUS,
      'claude:claude-haiku-5-5': UserStatus.ACTIVE,
      'claude:claude-sonnet-5-5': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-fable-5-1': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-5-5': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-fable-5': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-5': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-sonnet-5': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-4-8': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-4-7': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-4-6': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-sonnet-4-6': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-opus-4-5-20251101': UserStatus.SUBSCRIPTION_PRO,
      'claude:claude-haiku-4-5-20251001': UserStatus.SUBSCRIPTION_PLUS,
      ...Object.fromEntries(
        ALIBABA_MODELS.map((model) => [model.id, model.available_for_status]),
      ),
    });
    const imageModels = new Set([
      'gpt-image-2.5-sunburst',
      'gpt-image-2.5-flare',
      'gpt-image-1-mini',
      'gpt-image-2',
      'gpt-image-1.5',
      'gpt-image-1',
      'chatgpt-image-latest',
      'gemini-nano-banana-2.1',
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-lite-image',
      'gemini-2.5-flash-image',
      'grok-imagine-image-2.0',
      'grok-imagine-image',
      'grok-imagine-image-quality',
      ...ALIBABA_MODELS.filter((model) => model.for_image).map(
        (model) => model.name,
      ),
    ]);
    expect(catalog.filter((model) => model.provider_id === 1)).toHaveLength(28);
    expect(catalog.filter((model) => model.provider_id === 2)).toHaveLength(14);
    expect(catalog.filter((model) => model.provider_id === 3)).toHaveLength(7);
    expect(catalog.filter((model) => model.provider_id === 5)).toHaveLength(13);
    expect(catalog.filter((model) => model.provider_id === 6)).toHaveLength(
      ALIBABA_MODELS.length,
    );
    for (const model of catalog) {
      const provider = await providers.findOneByOrFail({
        id: model.provider_id,
      });
      expect(model.id).toBe(`${provider.name}:${model.name}`);
      expect(model.for_image).toBe(imageModels.has(model.name));
    }
    expect(await promotions.count()).toBe(2);
    expect(
      await promotions.findOneByOrFail({ id: FIRST_SUBSCRIPTION_PROMOTION_ID }),
    ).toMatchObject({
      type: PromotionType.NEW_USER,
      reward_type: PromotionRewardType.FREE_DAYS,
      reward_value: 3,
      max_usages_per_user: 1,
      max_usages: null,
      ends_at: null,
    });
    expect(
      await promotions.findOneByOrFail({
        id: SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
      }),
    ).toMatchObject({
      type: PromotionType.MANUAL,
      reward_type: PromotionRewardType.PERCENT_DISCOUNT,
      reward_value: 10,
      max_usages_per_user: null,
    });
    expect(
      await dataSource.query(
        `SELECT to_regclass('public.migrations') AS table`,
      ),
    ).toEqual([{ table: null }]);
  });

  it('Не создаёт дубликаты и не изменяет записи при повторном запуске', async () => {
    await seed.onModuleInit();
    const initialModels = await models.find({ order: { id: 'ASC' } });
    const initialPromotions = await promotions.find({ order: { id: 'ASC' } });

    await seed.onModuleInit();

    expect(await providers.count()).toBe(SEED_PROVIDERS.length);
    expect(await models.find({ order: { id: 'ASC' } })).toEqual(initialModels);
    expect(await promotions.find({ order: { id: 'ASC' } })).toEqual(
      initialPromotions,
    );
  });

  it('Сериализует одновременные запуски seed без дубликатов', async () => {
    await Promise.all([seed.onModuleInit(), seed.onModuleInit()]);

    expect(await providers.count()).toBe(SEED_PROVIDERS.length);
    expect(await models.count()).toBe(SEED_MODELS.length);
    expect(await promotions.count()).toBe(2);
  });

  it.each([
    FIRST_SUBSCRIPTION_PROMOTION_ID,
    SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
  ])('Обновляет поля акции %s из seed и сохраняет остальные', async (id) => {
    const existing = await promotions.save({
      id,
      name: 'Существующая акция',
      type: PromotionType.MANUAL,
      reward_type: PromotionRewardType.PERCENT_DISCOUNT,
      reward_value: 20,
      max_usages_per_user: 5,
      code: 'existing-code',
      max_usages: 42,
      created_at: new Date('2020-01-01T00:00:00Z'),
      ends_at: new Date('2027-01-01T00:00:00Z'),
    });

    await seed.onModuleInit();

    expect(await promotions.count()).toBe(2);
    expect(await promotions.findOneByOrFail({ id })).toEqual({
      ...existing,
      ...SEED_PROMOTIONS.find((promotion) => promotion.id === id),
    });
  });

  it('Обновляет существующие модели и сохраняет сторонние записи', async () => {
    await dataSource.query(`
      INSERT INTO "model_provider" ("id", "name")
      VALUES (1, 'openai'), (20, 'custom')
    `);
    const existing = await models.save({
      id: 'openai:gpt-5.4-mini',
      provider_id: 20,
      name: 'old-model-name',
      description: 'Существующее описание',
      for_image: true,
      available_for_status: UserStatus.SUBSCRIPTION_PRO,
    });
    const custom = await models.save({
      id: 'custom:custom-model',
      provider_id: 20,
      name: 'custom-model',
      description: 'Сторонняя модель',
      for_image: false,
      available_for_status: UserStatus.ACTIVE,
    });

    await seed.onModuleInit();

    expect(await providers.count()).toBe(SEED_PROVIDERS.length + 1);
    expect(await models.count()).toBe(SEED_MODELS.length + 1);
    expect(await models.findOneByOrFail({ id: existing.id })).toMatchObject({
      id: existing.id,
      provider_id: 1,
      name: 'gpt-5.4-mini',
      description: 'Быстрая модель для повседневных задач',
      for_image: false,
      available_for_status: UserStatus.ACTIVE,
    });
    expect(await models.findOneByOrFail({ id: custom.id })).toEqual(custom);
    expect((await providers.save({ name: 'another-provider' })).id).toBe(21);
  });

  it.each([
    { id: 10, name: 'openai' },
    { id: 3, name: 'google' },
  ])('Явно сообщает о конфликте провайдера $id=$name', async (provider) => {
    await dataSource.query(
      `INSERT INTO "model_provider" ("id", "name") VALUES ($1, $2)`,
      [provider.id, provider.name],
    );

    await expect(seed.onModuleInit()).rejects.toThrow(
      'Model provider mapping conflict',
    );

    expect(await providers.find()).toEqual([provider]);
    expect(await models.count()).toBe(0);
    expect(await promotions.count()).toBe(0);
  });

  it('Обновляет имя провайдера по его фиксированному ID', async () => {
    await dataSource.query(
      `INSERT INTO "model_provider" ("id", "name") VALUES (1, 'outdated-name')`,
    );

    await seed.onModuleInit();

    expect(await providers.findOneByOrFail({ id: 1 })).toEqual({
      id: 1,
      name: 'openai',
    });
    expect(await providers.count()).toBe(SEED_PROVIDERS.length);
  });

  it('Откатывает все добавленные записи при ошибке заполнения', async () => {
    await dataSource.query(`
      ALTER TABLE "model" ADD CONSTRAINT "reject_seed_model"
      CHECK ("name" <> 'gpt-5.4')
    `);

    await expect(seed.onModuleInit()).rejects.toThrow('reject_seed_model');

    expect(await providers.count()).toBe(0);
    expect(await models.count()).toBe(0);
    expect(await promotions.count()).toBe(0);
  });

  it('Откатывает обновления провайдеров и моделей при ошибке обновления акции', async () => {
    await seed.onModuleInit();
    await providers.update({ id: 1 }, { name: 'outdated-name' });
    await models.update(
      { id: 'openai:gpt-5.4-mini' },
      { description: 'Старое описание' },
    );
    await promotions.update(
      { id: FIRST_SUBSCRIPTION_PROMOTION_ID },
      { reward_value: 99 },
    );
    await dataSource.query(`
      ALTER TABLE "promotion" ADD CONSTRAINT "reject_seed_promotion"
      CHECK ("reward_value" <> 3)
    `);

    await expect(seed.onModuleInit()).rejects.toThrow('reject_seed_promotion');

    expect(await providers.findOneByOrFail({ id: 1 })).toMatchObject({
      name: 'outdated-name',
    });
    expect(
      await models.findOneByOrFail({ id: 'openai:gpt-5.4-mini' }),
    ).toMatchObject({ description: 'Старое описание' });
    expect(
      await promotions.findOneByOrFail({ id: FIRST_SUBSCRIPTION_PROMOTION_ID }),
    ).toMatchObject({ reward_value: 99 });
  });

  it('Не уменьшает уже продвинутую последовательность ID провайдеров', async () => {
    await dataSource.query(
      `SELECT setval(pg_get_serial_sequence('model_provider', 'id'), 100, TRUE)`,
    );

    await seed.onModuleInit();

    expect((await providers.save({ name: 'another-provider' })).id).toBe(101);
  });

  it('Поддерживает строковые ID моделей и внешние ключи чатов', async () => {
    await seed.onModuleInit();
    const user = await dataSource.getRepository(User).save({
      email: 'user@example.com',
    });
    const chat = await dataSource.getRepository(Chat).save({
      user_id: user.id,
      model_id: 'openai:gpt-5.4',
    });
    const savedChat = await dataSource
      .getRepository(Chat)
      .findOneByOrFail({ id: chat.id });

    expect(savedChat.model_id).toBe('openai:gpt-5.4');
    expect((await savedChat.model).name).toBe('gpt-5.4');

    await models.update(
      { id: 'openai:gpt-5.4' },
      {
        description: 'Старое описание',
        available_for_status: UserStatus.GUEST,
      },
    );
    await seed.onModuleInit();
    const updatedChat = await dataSource
      .getRepository(Chat)
      .findOneByOrFail({ id: chat.id });
    expect(updatedChat.model_id).toBe('openai:gpt-5.4');
    expect(await updatedChat.model).toMatchObject({
      id: 'openai:gpt-5.4',
      description: 'Модель для сложных задач и программирования',
      available_for_status: UserStatus.SUBSCRIPTION_PLUS,
    });

    await expect(
      dataSource.query(`UPDATE "chat" SET "model_id" = 'openai:missing-model'`),
    ).rejects.toThrow('foreign key constraint');
  });

  it('Создаёт поисковые индексы и сохраняет их при синхронизации схемы', async () => {
    await seed.onModuleInit();
    const readIndexes = () =>
      dataSource.query<{ indexname: string; indexdef: string; oid: number }[]>(`
        SELECT indexes.indexname, indexes.indexdef, pg_class.oid
        FROM pg_indexes indexes
        JOIN pg_class ON pg_class.relname = indexes.indexname
        WHERE indexes.tablename = 'prompt'
          AND indexes.indexname IN (
            'idx_prompt_input_trgm', 'idx_prompt_response_trgm',
            'idx_prompt_input_fts', 'idx_prompt_response_fts'
          )
        ORDER BY indexes.indexname
      `);
    const indexes = await readIndexes();
    expect(indexes).toHaveLength(4);
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          indexname: 'idx_prompt_input_trgm',
          indexdef: expect.stringContaining('gin_trgm_ops'),
        }),
        expect.objectContaining({
          indexname: 'idx_prompt_response_trgm',
          indexdef: expect.stringContaining('gin_trgm_ops'),
        }),
        expect.objectContaining({
          indexname: 'idx_prompt_input_fts',
          indexdef: expect.stringContaining('to_tsvector'),
        }),
        expect.objectContaining({
          indexname: 'idx_prompt_response_fts',
          indexdef: expect.stringContaining('to_tsvector'),
        }),
      ]),
    );

    await dataSource.synchronize();
    await seed.onModuleInit();

    expect(await readIndexes()).toEqual(indexes);
    expect(
      await models.findOneByOrFail({ id: 'openai:gpt-5.4' }),
    ).toBeDefined();
  });

  it('Синхронизация создаёт уникальный response_id и значения по умолчанию для токенов', async () => {
    await dataSource.query(`
      INSERT INTO "prompt_meta" (
        "response_id", "input_tokens", "output_tokens", "thinking_tokens"
      ) VALUES ('response-id', 100, 200, 50)
    `);
    await dataSource.query(`
      INSERT INTO "prompt_meta" ("prompt_id", "response_id")
      VALUES ('53453b1a-654b-435c-bbba-3f190ef5b026', 'response-id')
      ON CONFLICT ("response_id") DO UPDATE SET "prompt_id" = EXCLUDED."prompt_id"
    `);

    expect(
      await dataSource.getRepository(PromptMeta).findBy({
        response_id: 'response-id',
      }),
    ).toEqual([
      expect.objectContaining({
        prompt_id: '53453b1a-654b-435c-bbba-3f190ef5b026',
        input_tokens: 100,
        output_tokens: 200,
        thinking_tokens: 50,
      }),
    ]);
    await dataSource.query(
      `INSERT INTO "prompt_meta" ("response_id") VALUES ('new-response-id')`,
    );
    expect(
      await dataSource.getRepository(PromptMeta).findOneByOrFail({
        response_id: 'new-response-id',
      }),
    ).toMatchObject({
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
    });
  });
});
