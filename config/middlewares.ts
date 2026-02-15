export default ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      origin: env.array('CORS_ORIGINS', [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
      ]),
      credentials: true,
      headers: '*',
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: env('FORM_LIMIT', '50mb'),
      jsonLimit: env('JSON_LIMIT', '50mb'),
      textLimit: env('TEXT_LIMIT', '50mb'),
      formidable: {
        maxFileSize: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
