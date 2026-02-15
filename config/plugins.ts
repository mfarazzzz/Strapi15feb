export default ({ env }) => ({
  upload: {
    config: {
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
    },
  },
  i18n: {
    enabled: true,
    config: {
      locales: ['hi', 'en'],
      defaultLocale: 'hi',
    },
  },
});
