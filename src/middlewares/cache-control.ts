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
      ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=600');
      return;
    }
  };
};
