export default {
  async index(ctx) {
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

    // Fetch hero articles (featured)
    const hero = await es.findMany('api::article.article', {
      filters: { isFeatured: true },
      sort: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      populate,
      limit: 5,
      publicationState: 'live'
    });

    // Fetch editorial articles
    const editorial = await es.findMany('api::article.article', {
      filters: {
        category: { slug: 'editorials' }
      },
      sort: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      populate,
      limit: 5,
      publicationState: 'live'
    });

    // Fetch articles for each category section
    const sections: Record<string, any> = {};

    for (const slug of categories) {
      const articles = await es.findMany('api::article.article', {
        filters: {
          category: { slug }
        },
        sort: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        populate,
        limit: 6,
        publicationState: 'live'
      });

      sections[slug] = articles;
    }

    // Set caching headers for CDN caching (60 seconds)
    ctx.set('Cache-Control', 'public, max-age=60');

    return {
      hero,
      editorial,
      sections
    };
  }
};
