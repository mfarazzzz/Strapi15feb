type CacheConfig = {
  enabled?: boolean;
  url?: string;
  ttlSeconds?: number;
  keyPrefix?: string;
};

let client: any = null;
let initPromise: Promise<void> | null = null;

const getClient = async (config: CacheConfig) => {
  if (client || initPromise) {
    if (initPromise) await initPromise;
    return client;
  }

  const enabled = config.enabled !== false;
  const url = (config.url || '').trim();
  if (!enabled || !url) return null;

  const { createClient } = await import('redis');
  const redisClient = createClient({ url });
  initPromise = redisClient.connect().then(() => {
    client = redisClient;
  });

  await initPromise;
  return client;
};

export default (config: CacheConfig) => {
  return async (ctx: any, next: any) => {
    if (ctx.method !== 'GET') {
      await next();
      return;
    }

    const path = ctx.request?.path || '';
    if (!path.startsWith('/api')) {
      await next();
      return;
    }

    const authHeader =
      ctx.request?.header?.authorization ||
      ctx.request?.headers?.authorization ||
      ctx.headers?.authorization;
    const hasAuth = typeof authHeader === 'string' && authHeader.trim() !== '';
    if (hasAuth || ctx.state?.user) {
      await next();
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
    if (!isAllowed) {
      await next();
      return;
    }

    const redis = await getClient(config);
    if (!redis) {
      await next();
      return;
    }

    const ttlSeconds = Number.isFinite(Number(config.ttlSeconds)) ? Number(config.ttlSeconds) : 60;
    const prefix = (config.keyPrefix || 'strapi-cache').trim() || 'strapi-cache';
    const key = `${prefix}:${ctx.request?.url || path}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        ctx.set('X-Cache', 'HIT');
        ctx.type = 'application/json';
        ctx.body = JSON.parse(cached);
        return;
      }
    } catch {
      void 0;
    }

    await next();

    if (ctx.status === 200 && ctx.body) {
      try {
        await redis.set(key, JSON.stringify(ctx.body), { EX: Math.max(1, ttlSeconds) });
        ctx.set('X-Cache', 'MISS');
      } catch {
        void 0;
      }
    }
  };
};

/**
 * invalidateArticleCache
 *
 * Deletes all Redis cache keys that match article-related URL patterns.
 * Called from the article controller after publish, update, and delete.
 *
 * Non-fatal: if Redis is unavailable or the delete fails, the error is
 * swallowed so the write operation is never blocked by cache issues.
 *
 * @param config  The same CacheConfig used by the middleware (from env vars)
 * @param articleId  Numeric or string article ID for targeted invalidation
 */
export const invalidateArticleCache = async (
  config: CacheConfig,
  articleId?: string | number,
): Promise<void> => {
  const redis = await getClient(config).catch(() => null);
  if (!redis) return;

  const prefix = (config.keyPrefix || 'strapi-cache').trim() || 'strapi-cache';

  // Patterns to invalidate:
  //   1. All article list/search endpoints
  //   2. The specific article by ID (if provided)
  const patterns: string[] = [`${prefix}:/api/articles*`];
  if (articleId !== undefined && articleId !== null) {
    patterns.push(`${prefix}:/api/articles/${articleId}*`);
  }

  try {
    for (const pattern of patterns) {
      const keys: string[] = await redis.keys(pattern).catch(() => []);
      if (keys.length > 0) {
        await redis.del(keys).catch(() => void 0);
      }
    }
  } catch {
    // Non-fatal — cache invalidation failure must never block the write
    void 0;
  }
};
