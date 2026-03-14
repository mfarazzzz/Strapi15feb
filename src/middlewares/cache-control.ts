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
      const authHeader =
        ctx.request?.header?.authorization ||
        ctx.request?.headers?.authorization ||
        ctx.headers?.authorization;
      const hasAuth = typeof authHeader === 'string' && authHeader.trim() !== '';
      const hasUser = Boolean(ctx.state?.user);

      const appendVary = (current: unknown, value: string) => {
        const existing = typeof current === 'string' ? current.split(',').map((v) => v.trim()).filter(Boolean) : [];
        const next = new Set(existing);
        next.add(value);
        return Array.from(next).join(', ');
      };

      ctx.set('Vary', appendVary(ctx.response?.get?.('Vary'), 'Origin'));
      ctx.set('Vary', appendVary(ctx.response?.get?.('Vary'), 'Accept-Encoding'));

      if (hasAuth || hasUser) {
        ctx.set('Vary', appendVary(ctx.response?.get?.('Vary'), 'Authorization'));
        ctx.set('Cache-Control', 'private, no-store');
        return;
      }

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
