export default ({ env }) => {
  const isProduction = String(env('NODE_ENV', '')).trim().toLowerCase() === 'production';
  const configuredOrigins = env.array('CORS_ORIGINS', []);
  const origins = (Array.isArray(configuredOrigins) ? configuredOrigins : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const safeOrigins = isProduction ? origins.filter((o) => o !== '*') : origins;

  return [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: safeOrigins,
      credentials: true,
      headers: env.array('CORS_HEADERS', ['Content-Type', 'Authorization', 'Origin', 'Accept']),
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: env('FORM_LIMIT', isProduction ? '25mb' : '50mb'),
      jsonLimit: env('JSON_LIMIT', isProduction ? '10mb' : '50mb'),
      textLimit: env('TEXT_LIMIT', isProduction ? '10mb' : '50mb'),
      formidable: {
        maxFileSize: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
  ];
};
