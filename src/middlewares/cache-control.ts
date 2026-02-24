export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    if (ctx.method === 'GET') {
      const path = ctx.request?.path || '';
      const isApi = path.startsWith('/api');
      const isAdminLike = path.startsWith('/admin') || path.startsWith('/api/admin') || path.includes('/admin');
      const publicationState = ctx.query?.publicationState;
      const isPublic = !isAdminLike && !ctx?.state?.user;

      if (isApi && isPublic) {
        if (!publicationState || publicationState === 'preview') {
          ctx.query.publicationState = 'live';
        }
      }
    }

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
