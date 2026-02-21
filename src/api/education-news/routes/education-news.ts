export default {
  routes: [
    {
      method: 'GET',
      path: '/education-news',
      handler: 'education-news.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/education-news/slug/:slug',
      handler: 'education-news.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/education-news/:id',
      handler: 'education-news.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/education-news',
      handler: 'education-news.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/education-news/:id',
      handler: 'education-news.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/education-news/:id',
      handler: 'education-news.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
