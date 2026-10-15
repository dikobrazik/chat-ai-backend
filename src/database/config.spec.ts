jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('ca')),
}));

import { getDatabaseConnectionOptions } from './config';

const createGetter = (values: Record<string, string>) => (key: string) =>
  values[key];

const credentials = {
  POSTGRES_USER: 'user',
  POSTGRES_PASSWORD: 'password',
  POSTGRES_DB: 'database',
};

describe('getDatabaseConnectionOptions', () => {
  it('disables SSL for the internal Docker Postgres', () => {
    const options = getDatabaseConnectionOptions(
      createGetter({
        ...credentials,
        DB_HOST: 'postgres',
        DB_SSL: 'true',
      }),
    );

    expect(options.ssl).toBe(false);
  });

  it('enables SSL by default for an external Postgres', () => {
    const options = getDatabaseConnectionOptions(
      createGetter({
        ...credentials,
        DB_HOST: 'database.example.com',
      }),
    );

    expect(options.ssl).toEqual({ ca: Buffer.from('ca') });
  });

  it('supports disabling SSL for an external Postgres', () => {
    const options = getDatabaseConnectionOptions(
      createGetter({
        ...credentials,
        DB_HOST: 'database.example.com',
        DB_SSL: ' FALSE ',
      }),
    );

    expect(options.ssl).toBe(false);
  });
});
