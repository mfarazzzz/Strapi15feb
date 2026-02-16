export default ({ env }) => {
  const isProduction = String(env('NODE_ENV', '')).trim().toLowerCase() === 'production';
  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    proxy: env.bool('STRAPI_PROXY', isProduction),
    app: {
      keys: env.array('APP_KEYS'),
    },
    admin: {
      serveAdminPanel: env.bool('SERVE_ADMIN_PANEL', true),
    },
  };
};
