import { readFileSync } from 'fs';
import { join } from 'path';

type EnvironmentGetter = (key: string) => string | undefined;

const getRequiredValue = (
  get: EnvironmentGetter,
  primaryKey: string,
  fallbackKey: string,
) => {
  const value = get(primaryKey) ?? get(fallbackKey);

  if (!value) {
    throw new Error(
      `Database environment variable ${primaryKey} or ${fallbackKey} is required`,
    );
  }

  return value;
};

export const getDatabaseConnectionOptions = (get: EnvironmentGetter) => {
  const host = get('DB_HOST') ?? 'postgres';
  const isDockerPostgres = host === 'postgres';

  const username = getRequiredValue(
    get,
    isDockerPostgres ? 'POSTGRES_USER' : 'DB_USERNAME',
    isDockerPostgres ? 'DB_USERNAME' : 'POSTGRES_USER',
  );
  const password = getRequiredValue(
    get,
    isDockerPostgres ? 'POSTGRES_PASSWORD' : 'DB_PASS',
    isDockerPostgres ? 'DB_PASS' : 'POSTGRES_PASSWORD',
  );
  const database = getRequiredValue(
    get,
    isDockerPostgres ? 'POSTGRES_DB' : 'DB_NAME',
    isDockerPostgres ? 'DB_NAME' : 'POSTGRES_DB',
  );
  const sslEnabled = get('DB_SSL')
    ? get('DB_SSL') === 'true'
    : !isDockerPostgres;

  return {
    host,
    port: Number(get('DB_PORT') ?? 5432),
    username,
    password,
    database,
    ssl: sslEnabled
      ? {
          ca: readFileSync(join(process.cwd(), 'db.pem')),
        }
      : false,
  };
};
