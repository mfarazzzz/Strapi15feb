export default ({ env }) => {
  const isProduction = String(env('NODE_ENV', '')).trim().toLowerCase() === 'production';
  const configuredOrigins = env.array('CORS_ORIGINS', []);
  const origins = (Array.isArray(configuredOrigins) ? configuredOrigins : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const fallbackOrigins = [
    'https://rampurnews.com',
    'https://www.rampurnews.com',
    'http://localhost:3000',
  ];
  const safeOrigins = isProduction
    ? origins.filter((o) => o !== '*')
    : origins.length > 0
      ? origins
      : fallbackOrigins;

  return [
    'strapi::logger',
    {
      name: 'global::slow-request',
      config: {
        thresholdMs: env.int('SLOW_REQUEST_THRESHOLD_MS', 1000),
      },
    },
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:'],
          },
        },
        frameguard: { action: 'deny' },
        hsts: { maxAge: 31536000, includeSubDomains: true },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        origin: safeOrigins.length > 0 ? safeOrigins : fallbackOrigins,
        credentials: true,
        headers: env.array('CORS_HEADERS', ['Content-Type', 'Authorization', 'Origin', 'Accept']),
      },
    },
    {
      name: 'strapi::rateLimit',
      config: {
        interval: env.int('RATE_LIMIT_INTERVAL', 60 * 1000),
        max: env.int('RATE_LIMIT_MAX', 200),
      },
    },
    'strapi::compression',
    'strapi::query',
    'global::cache-control',
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
