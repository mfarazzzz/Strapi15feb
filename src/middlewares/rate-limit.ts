/**
 * global::rate-limit
 *
 * Koa-compatible rate limiter for Strapi v5.
 *
 * Replaces the removed strapi::rateLimit built-in (which was Strapi v4 only).
 * In Strapi v5, strapi::rateLimit does not exist — using it causes:
 *   "Middleware strapi::rateLimit: middlewareFactory is not a function"
 *
 * This implementation uses an in-process sliding-window counter per IP.
 * It is intentionally lightweight — for production at scale, use NGINX
 * limit_req or Cloudflare Rate Limiting instead (see docs/cdn-cloudflare-setup.md).
 *
 * Config (via config/middlewares.ts):
 *   interval  — window size in ms  (default: 60000 = 1 minute)
 *   max       — max requests per window per IP (default: 200)
 *   skip      — optional function (ctx) => boolean to bypass rate limiting
 */

type RateLimitConfig = {
  interval?: number;
  max?: number;
  skip?: (ctx: any) => boolean;
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

export default (config: RateLimitConfig, _helpers: { strapi: any }) => {
  const interval = typeof config?.interval === 'number' && config.interval > 0
    ? config.interval
    : 60_000;
  const max = typeof config?.max === 'number' && config.max > 0
    ? config.max
    : 200;

  // In-process store: IP → { count, resetAt }
  // Automatically evicted when the window expires on next request from that IP.
  const store = new Map<string, WindowEntry>();

  // Periodic cleanup to prevent unbounded memory growth on high-traffic servers.
  // Runs every `interval` ms and removes expired entries.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, interval);
  // Allow Node.js to exit even if this interval is still active
  cleanup.unref();

  return async (ctx: any, next: any) => {
    // Skip rate limiting for admin panel and authenticated CMS requests
    if (config?.skip?.(ctx)) {
      await next();
      return;
    }

    const path: string = ctx.request?.path || '';

    // Never rate-limit the Strapi admin panel
    if (path.startsWith('/admin')) {
      await next();
      return;
    }

    // Resolve client IP — respects X-Forwarded-For when behind a proxy
    const forwarded = ctx.request?.header?.['x-forwarded-for'] ||
      ctx.request?.headers?.['x-forwarded-for'];
    const ip: string = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : ctx.request?.ip || ctx.ip || 'unknown'
    );

    const now = Date.now();
    const existing = store.get(ip);

    if (!existing || now >= existing.resetAt) {
      // New window
      store.set(ip, { count: 1, resetAt: now + interval });
      ctx.set('X-RateLimit-Limit', String(max));
      ctx.set('X-RateLimit-Remaining', String(max - 1));
      ctx.set('X-RateLimit-Reset', String(Math.ceil((now + interval) / 1000)));
      await next();
      return;
    }

    existing.count += 1;
    const remaining = Math.max(0, max - existing.count);

    ctx.set('X-RateLimit-Limit', String(max));
    ctx.set('X-RateLimit-Remaining', String(remaining));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));

    if (existing.count > max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: 'Too many requests, please try again later.',
        },
      };
      return;
    }

    await next();
  };
};
