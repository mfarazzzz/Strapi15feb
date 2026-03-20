export default ({ env }) => ({
  upload: {
    config: {
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
      responsiveDimensions: true,
      breakpoints: {
        xxlarge: 2000,
        xlarge: 1600,
        large: 1200,
        medium: 800,
        small: 500,
        thumbnail: 250,
      },
    },
  },
  i18n: {
    enabled: true,
    config: {
      locales: ['hi', 'en'],
      defaultLocale: 'hi',
    },
  },
  'rbac-manager': {
    enabled: true,
    resolve: './src/plugins/rbac-manager',
  },
});
