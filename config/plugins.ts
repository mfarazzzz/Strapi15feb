export default () => ({
  upload: {
    config: {
      sizeLimit: parseInt(process.env.UPLOAD_SIZE_LIMIT || '52428800', 10),
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
