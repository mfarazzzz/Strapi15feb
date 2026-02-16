export default {
  routes: [
    {
      method: 'GET',
      path: '/categories',
      handler: 'category.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/categories/slug/:slug',
      handler: 'category.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/categories/:id',
      handler: 'category.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/categories',
      handler: 'category.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/categories/:id',
      handler: 'category.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/categories/:id',
      handler: 'category.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
