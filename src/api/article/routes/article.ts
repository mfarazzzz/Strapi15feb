export default {
  routes: [
    {
      method: 'GET',
      path: '/articles/admin',
      handler: 'article.adminFind',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'GET',
      path: '/articles/admin/slug/:slug',
      handler: 'article.adminFindBySlug',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'GET',
      path: '/articles/admin/:id',
      handler: 'article.adminFindOne',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'GET',
      path: '/articles',
      handler: 'article.find',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/featured',
      handler: 'article.featured',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/featured-hero',
      handler: 'article.hero',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/breaking',
      handler: 'article.breaking',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/trending',
      handler: 'article.trending',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/by-category/:slug',
      handler: 'article.byCategory',
      config: { auth: false, policies: ['global::public-defaults'] }
    },
    {
      method: 'GET',
      path: '/articles/search',
      handler: 'article.search',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/news-sitemap',
      handler: 'article.newsSitemap',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/robots.txt',
      handler: 'article.robots',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/slug/:slug',
      handler: 'article.findBySlug',
      config: { auth: false, policies: ['global::public-defaults'] },
    },
    {
      method: 'GET',
      path: '/articles/:id',
      handler: 'article.findOne',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'POST',
      path: '/articles',
      handler: 'article.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/articles/:id',
      handler: 'article.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'POST',
      path: '/articles/:id/publish',
      handler: 'article.publish',
      // Only publishers can publish; cms-role still validates the JWT
      config: { auth: {}, policies: ['global::cms-role', { name: 'global::workflow-role', config: { minRole: 'publisher' } }] },
    },
    {
      method: 'POST',
      path: '/articles/:id/unpublish',
      handler: 'article.unpublish',
      config: { auth: {}, policies: ['global::cms-role', { name: 'global::workflow-role', config: { minRole: 'publisher' } }] },
    },
    {
      method: 'POST',
      path: '/articles/:id/approve',
      handler: 'article.approve',
      // Editors and publishers can approve
      config: { auth: {}, policies: ['global::cms-role', { name: 'global::workflow-role', config: { minRole: 'editor' } }] },
    },
    {
      method: 'POST',
      path: '/articles/:id/reject',
      handler: 'article.reject',
      config: { auth: {}, policies: ['global::cms-role', { name: 'global::workflow-role', config: { minRole: 'editor' } }] },
    },
    {
      method: 'DELETE',
      path: '/articles/:id',
      handler: 'article.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
