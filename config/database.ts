import path from 'path';

// Warn loudly if placeholder secrets are still in use
const DEFAULT_SECRETS = new Set([
  'toBeModified1,toBeModified2',
  'tobemodified',
  '',
]);

const warnIfDefault = (name: string, value: string | undefined) => {
  if (!value || DEFAULT_SECRETS.has(value.trim())) {
    console.warn(
      `[strapi] WARNING: ${name} is using a default/placeholder value. ` +
      `Set a real secret in your .env before deploying to production.`,
    );
  }
};

export default ({ env }) => {
  const nodeEnv = String(env('NODE_ENV', '')).trim().toLowerCase();
  const isProduction = nodeEnv === 'production';
  const isDev = nodeEnv === 'development' || nodeEnv === '';

  // In production, always require postgres. In non-dev non-prod (e.g. staging),
  // also default to postgres to prevent accidental SQLite usage.
  const defaultClient = isDev ? 'sqlite' : 'postgres';
  const client = env('DATABASE_CLIENT', defaultClient);

  if (!isDev && client === 'sqlite') {
    console.error(
      '[strapi] FATAL: SQLite is not supported outside of development. ' +
      'Set DATABASE_CLIENT=postgres and configure DATABASE_URL.',
    );
    // Throw so the process exits cleanly rather than running with SQLite in prod.
    throw new Error('SQLite is not allowed in non-development environments.');
  }

  if (isProduction) {
    warnIfDefault('APP_KEYS', env('APP_KEYS'));
    warnIfDefault('API_TOKEN_SALT', env('API_TOKEN_SALT'));
    warnIfDefault('ADMIN_JWT_SECRET', env('ADMIN_JWT_SECRET'));
    warnIfDefault('JWT_SECRET', env('JWT_SECRET'));
  }

  const connections = {
    mysql: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    postgres: {
      connection: {
        connectionString: env('DATABASE_URL'),
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
        schema: env('DATABASE_SCHEMA', 'public'),
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
