jest.mock('./config', () => ({
  getDatabaseConnectionOptions: jest.fn(() => ({
    host: 'localhost',
    port: 5432,
    username: 'test',
    password: 'test',
    database: 'test',
    ssl: false,
  })),
}));

import dataSource from './data-source';

describe('DataSource для TypeORM CLI', () => {
  it('Не синхронизирует и не удаляет схему при запуске миграций', () => {
    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      synchronize: false,
      dropSchema: false,
    });
    expect(dataSource.isInitialized).toBe(false);
  });

  it('Регистрирует сущности приложения и загружает исходные миграции', () => {
    expect(dataSource.options.entities).toHaveLength(15);
    expect(dataSource.options.migrations).toEqual([
      expect.stringMatching(/[/\\]database[/\\]migrations[/\\]\*\.ts$/),
    ]);
  });
});
