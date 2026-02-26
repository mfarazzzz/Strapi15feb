export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    await next();
    if (ctx.method !== 'GET') return;

    const path = ctx.request?.path || '';
    if (path.startsWith('/admin')) return;
    if (path.startsWith('/uploads')) {
      ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }

    if (path.startsWith('/api')) {
      const allowList = [
        '/api/articles',
        '/api/editorials',
        '/api/categories',
        '/api/authors',
        '/api/tags',
        '/api/settings',
      ];
      const isAllowed = allowList.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (isAllowed) {
        ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=600');
      } else {
        ctx.set('Cache-Control', 'no-store');
      }
      return;
    }
  };
};
