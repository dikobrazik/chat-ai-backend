import 'reflect-metadata';

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { SeedSubscriptionPromotions1792129692749 } from 'src/database/migrations/1792129692749-seed-subscription-promotions';
import {
  Promotion,
  PromotionRewardType,
  PromotionType,
} from 'src/entities/Promotion';
import {
  FIRST_SUBSCRIPTION_PROMOTION_ID,
  SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
} from 'src/promotion/constants';
import { DataSource, QueryRunner, Repository } from 'typeorm';

jest.setTimeout(120_000);

describe('Миграция акций для подписок', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let queryRunner: QueryRunner;
  let repository: Repository<Promotion>;
  const migration = new SeedSubscriptionPromotions1792129692749();

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          entities: [Promotion],
          synchronize: true,
        }),
      ],
    }).compile();

    const dataSource = moduleRef.get(DataSource);
    repository = dataSource.getRepository(Promotion);
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
  });

  afterEach(async () => {
    await repository.clear();
  });

  afterAll(async () => {
    await queryRunner?.release();
    await moduleRef?.close();
    await container?.stop();
  });

  it('Создаёт пробную акцию на 3 дня и скидку 10% на шесть месяцев', async () => {
    await migration.up(queryRunner);

    expect(await repository.count()).toBe(2);
    expect(
      await repository.findOneByOrFail({ id: FIRST_SUBSCRIPTION_PROMOTION_ID }),
    ).toMatchObject({
      type: PromotionType.NEW_USER,
      reward_type: PromotionRewardType.FREE_DAYS,
      reward_value: 3,
      max_usages_per_user: 1,
      max_usages: null,
      ends_at: null,
    });
    expect(
      await repository.findOneByOrFail({
        id: SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
      }),
    ).toMatchObject({
      type: PromotionType.MANUAL,
      reward_type: PromotionRewardType.PERCENT_DISCOUNT,
      reward_value: 10,
      max_usages_per_user: null,
      max_usages: null,
      ends_at: null,
    });
  });

  it('Не создаёт дубликаты при повторном выполнении', async () => {
    await migration.up(queryRunner);
    const promotions = await repository.find({ order: { id: 'ASC' } });

    await migration.up(queryRunner);

    expect(await repository.find({ order: { id: 'ASC' } })).toEqual(promotions);
  });

  it.each([
    FIRST_SUBSCRIPTION_PROMOTION_ID,
    SIX_MONTHS_SUBSCRIPTION_PROMOTION_ID,
  ])('Сохраняет существующую акцию %s и добавляет недостающую', async (id) => {
    const existing = await repository.save({
      id,
      name: 'Существующая акция',
      type: PromotionType.MANUAL,
      reward_type: PromotionRewardType.PERCENT_DISCOUNT,
      reward_value: 20,
      max_usages_per_user: 5,
      ends_at: new Date('2027-01-01T00:00:00Z'),
    });

    await migration.up(queryRunner);

    expect(await repository.count()).toBe(2);
    expect(await repository.findOneByOrFail({ id })).toEqual(existing);
  });

  it('Не удаляет акции при откате', async () => {
    await migration.up(queryRunner);
    const promotions = await repository.find({ order: { id: 'ASC' } });

    await migration.down(queryRunner);
    await migration.up(queryRunner);

    expect(await repository.find({ order: { id: 'ASC' } })).toEqual(promotions);
  });
});
