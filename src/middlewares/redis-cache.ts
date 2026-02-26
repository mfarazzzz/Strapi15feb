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
