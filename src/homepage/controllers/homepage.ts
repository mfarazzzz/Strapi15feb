/**
 * Homepage controller — plain Koa controller, NOT a core content-type controller.
 *
 * Previously used factories.createCoreController('api::homepage.homepage' as any, ...)
 * which passed a non-existent UID to Strapi's content-type registry. In Node 20,
 * Strapi's internal route-validation code calls new URL() with the UID string,
 * and 'api::homepage.homepage' triggers DEP0170 ("The URL api::homepage.homepage
 * is invalid") because 'api:' is not a recognised URL scheme.
 *
 * Fix: export a plain object — Strapi v5 accepts plain controller objects for
 * custom (non-content-type) routes. No UID is needed or registered.
 */

export default ({ strapi }: { strapi: any }) => ({
  async index(ctx: any) {
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
      'entertainment',
    ];

    const populate = {
      featured_image: true,
      category: true,
      author: true,
    };

    try {
      // PARALLEL QUERIES — fetch all data in one round-trip
      const deterministicSort: any = [{ publishedAt: 'desc' }, { id: 'desc' }];

      const [hero, editorial, ...categoryArticles] = await Promise.all([
        // Query 1: Hero articles
        es.findMany('api::article.article', {
          filters: { isFeatured: true, publishedAt: { $notNull: true } },
          sort: deterministicSort,
          populate,
          limit: 5,
          publicationState: 'live',
        }),
        // Query 2: Editorial articles
        es.findMany('api::article.article', {
          filters: {
            publishedAt: { $notNull: true },
            $or: [
              { category: { slug: 'editorials' } },
              { categories: { slug: 'editorials' } },
            ],
          },
          sort: deterministicSort,
          populate,
          limit: 5,
          publicationState: 'live',
        }),
        // Queries 3-N: Category articles (all in parallel)
        ...categories.map((slug) =>
          es.findMany('api::article.article', {
            filters: {
              publishedAt: { $notNull: true },
              $or: [{ category: { slug } }, { categories: { slug } }],
            },
            sort: deterministicSort,
            populate,
            limit: 6,
            publicationState: 'live',
          }),
        ),
      ]);

      // Map category results to sections object
      const sections: Record<string, any[]> = {};
      categories.forEach((slug, index) => {
        sections[slug] = categoryArticles[index] || [];
      });

      // Debug logging
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_HOMEPAGE) {
        strapi.log.debug(
          'Homepage API - Hero articles:',
          (hero as any[]).map((a: any) => ({ slug: a.slug, publishedAt: a.publishedAt })),
        );
        strapi.log.debug(
          'Homepage API - Editorial articles:',
          (editorial as any[]).map((a: any) => ({ slug: a.slug, publishedAt: a.publishedAt })),
        );
        categories.forEach((slug, index) => {
          const articles: any[] = categoryArticles[index] || [];
          strapi.log.debug(
            `Homepage API - ${slug} articles:`,
            articles.map((a: any) => ({ slug: a.slug, publishedAt: a.publishedAt })),
          );
        });
      }

      return { hero, editorial, sections };
    } catch (error) {
      ctx.throw(500, 'Failed to fetch homepage data');
    }
  },

  async health(ctx: any) {
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
            pendingAcquires:
              typeof pool.numPendingAcquires === 'function'
                ? pool.numPendingAcquires()
                : undefined,
            pendingCreates:
              typeof pool.numPendingCreates === 'function'
                ? pool.numPendingCreates()
                : undefined,
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
      db: { ok: dbOk, error: dbError, pool: poolStats },
      responseTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  },
});
