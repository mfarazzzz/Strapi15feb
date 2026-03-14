import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::homepage.homepage' as any, ({ strapi }) => ({
  async index(ctx) {
    // Set caching headers for CDN
    ctx.set('Cache-Control', 'public, max-age=60');
    
    const es = strapi.entityService;

    const categories = [
      'rampur',
      'up',
      'national',
      'international',
      'sports',
      'business',
      'entertainment'
    ];

    const populate = {
      featured_image: true,
      category: true,
      author: true
    };

    try {
      // PARALLEL QUERIES - Fetch all data in parallel instead of sequential
      const [hero, editorial, ...categoryArticles] = await Promise.all([
        // Query 1: Hero articles
        es.findMany('api::article.article', {
          filters: { isFeatured: true },
          sort: [{ publishedAt: 'desc' }],
          populate,
          limit: 5,
          publicationState: 'live'
        }),
        // Query 2: Editorial articles
        es.findMany('api::article.article', {
          filters: {
            $or: [
              { category: { slug: 'editorials' } },
              { categories: { slug: 'editorials' } },
              { category: { $eq: 'editorials' } }
            ]
          },
          sort: [{ publishedAt: 'desc' }],
          populate,
          limit: 5,
          publicationState: 'live'
        }),
        // Queries 3-9: Category articles (all in parallel!)
        ...categories.map(slug => 
          es.findMany('api::article.article', {
            filters: {
              $or: [
                { category: { slug } },
                { categories: { slug } },
                { category: { $eq: slug } }
              ]
            },
            sort: [{ publishedAt: 'desc' }],
            populate,
            limit: 6,
            publicationState: 'live'
          })
        )
      ]);

      // Map category results to sections object
      const sections: Record<string, typeof hero> = {};
      categories.forEach((slug, index) => {
        sections[slug] = categoryArticles[index] || [];
      });

      return {
        hero,
        editorial,
        sections
      };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch homepage data');
    }
  },

  async health(ctx) {
    const start = Date.now();
    ctx.set('Cache-Control', 'no-store');
    ctx.type = 'application/json';

    let dbOk = true;
    let dbError: string | undefined;
    try {
      await strapi.db.connection.raw('select 1');
    } catch (e) {
      dbOk = false;
      dbError = e instanceof Error ? e.message : String(e || 'DB error');
      if (dbError.length > 500) dbError = dbError.slice(0, 500);
    }

    const pool = strapi?.db?.connection?.client?.pool;
    const poolStats =
      pool && typeof pool === 'object'
        ? {
            used: typeof pool.numUsed === 'function' ? pool.numUsed() : undefined,
            free: typeof pool.numFree === 'function' ? pool.numFree() : undefined,
            pendingAcquires: typeof pool.numPendingAcquires === 'function' ? pool.numPendingAcquires() : undefined,
            pendingCreates: typeof pool.numPendingCreates === 'function' ? pool.numPendingCreates() : undefined,
          }
        : undefined;

    ctx.body = {
      ok: dbOk,
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      memory: process.memoryUsage(),
      eventLoopDelayMs:
        typeof (globalThis as any).__eventLoopDelayMeanNs === 'number'
          ? Math.round(((globalThis as any).__eventLoopDelayMeanNs as number) / 1e6)
          : undefined,
      db: {
        ok: dbOk,
        error: dbError,
        pool: poolStats,
      },
      responseTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  },
}));
