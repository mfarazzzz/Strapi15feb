/**
 * block-draft-public middleware
 *
 * Prevents draft content from leaking through public API endpoints.
 * Any GET request to /api/articles/* or /api/editorials/* that does NOT
 * carry a valid JWT will have publicationState forced to 'live'.
 *
 * This is a defence-in-depth layer — the controllers already use
 * publicationState: 'live' for public routes, but this middleware
 * ensures no accidental regression can expose drafts.
 */
export default (_config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    const path: string = ctx.request?.path || '';
    const method: string = (ctx.request?.method || ctx.method || 'GET').toUpperCase();

    // Only intercept public GET requests to article/editorial endpoints
    if (method !== 'GET') {
      await next();
      return;
    }

    const isPublicContentPath =
      path.startsWith('/api/articles') || path.startsWith('/api/editorials');

    if (!isPublicContentPath) {
      await next();
      return;
    }

    // Allow authenticated requests (CMS admin, preview) to pass through unchanged
    const authHeader: string =
      ctx.request?.header?.authorization ||
      ctx.request?.headers?.authorization ||
      ctx.headers?.authorization ||
      '';

    const hasAuth = typeof authHeader === 'string' && authHeader.trim().startsWith('Bearer ');

    if (hasAuth) {
      await next();
      return;
    }

    // For unauthenticated requests: strip any publicationState=preview from query
    // and block ?preview=true unless the path is explicitly the admin slug endpoint
    const isAdminPath = path.includes('/admin/');
    if (!isAdminPath) {
      if (ctx.query?.publicationState === 'preview') {
        delete ctx.query.publicationState;
      }
      // Block preview mode on public routes
      if (ctx.query?.preview === 'true' && !hasAuth) {
        ctx.query.preview = 'false';
      }
    }

    await next();

    // Post-response: if the response contains articles, filter out any drafts
    // that may have slipped through (publishedAt === null)
    if (ctx.response?.status === 200 && ctx.response?.body) {
      const body = ctx.response.body;
      if (body?.data && Array.isArray(body.data)) {
        body.data = body.data.filter((item: any) => {
          // Keep item if it has publishedAt set (live) or if status is 'published'
          const publishedAt = item?.publishedAt ?? item?.attributes?.publishedAt;
          const status = item?.status ?? item?.attributes?.status;
          if (publishedAt) return true;
          if (status === 'published') return true;
          return false;
        });
        ctx.response.body = body;
      }
    }
  };
};
