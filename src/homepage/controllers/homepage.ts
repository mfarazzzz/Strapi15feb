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
  }
}));
