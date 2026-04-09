/**
 * block-draft-public middleware
 *
 * Defence-in-depth layer that prevents draft content from leaking through
 * public API endpoints, even if a controller has a bug.
 *
 * Strapi v5 uses `status: 'published' | 'draft'` (NOT publicationState).
 * This middleware enforces status=published on all unauthenticated public
 * requests to /api/articles and /api/editorials.
 *
 * It does NOT touch:
 *  - Admin routes (/api/articles/admin/*)
 *  - Authenticated requests (Bearer token present)
 *  - Non-GET methods (mutations are handled by their own auth policies)
 */
export default (_config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    const path: string = ctx.request?.path || '';
    const method: string = (ctx.request?.method || 'GET').toUpperCase();

    // Only intercept GET requests to public content endpoints
    if (method !== 'GET') {
      await next();
      return;
    }

    const isContentPath =
      path.startsWith('/api/articles') || path.startsWith('/api/editorials');

    if (!isContentPath) {
      await next();
      return;
    }

    // Admin routes are exempt — they need draft access
    if (path.includes('/admin/') || path.includes('/admin')) {
      await next();
      return;
    }

    // Authenticated requests (CMS users, preview with JWT) pass through
    const authHeader: string =
      ctx.request?.header?.authorization ||
      ctx.request?.headers?.authorization ||
      '';
    const hasAuth = authHeader.trim().startsWith('Bearer ');

    if (hasAuth) {
      await next();
      return;
    }

    // Validate preview token for unauthenticated preview requests
    const previewSecret = process.env.PREVIEW_SECRET;
    const requestToken = ctx.query?.token;
    const tokenValid = previewSecret && requestToken && requestToken === previewSecret;

    // Strip preview access if no valid token
    if (ctx.query?.preview === 'true' && !tokenValid) {
      ctx.query.preview = 'false';
      delete ctx.query.token;
    }

    // Force status=published on unauthenticated non-preview requests
    // This overrides any attempt to pass status=draft via query string
    if (!tokenValid || ctx.query?.preview !== 'true') {
      if (ctx.query?.status === 'draft') {
        ctx.query.status = 'published';
      }
      // Also strip legacy publicationState=preview
      if (ctx.query?.publicationState === 'preview') {
        ctx.query.publicationState = 'live';
      }
    }

    await next();
  };
};
