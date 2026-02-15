export default {
  routes: [
    {
      method: 'GET',
      path: '/pages',
      handler: 'page.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/pages/slug/:slug',
      handler: 'page.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/pages/:id',
      handler: 'page.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/pages',
      handler: 'page.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/pages/:id',
      handler: 'page.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/pages/:id',
      handler: 'page.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
