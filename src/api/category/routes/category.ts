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
      config: { auth: { scope: ['api::category.category.create'] } },
    },
    {
      method: 'PATCH',
      path: '/categories/:id',
      handler: 'category.update',
      config: { auth: { scope: ['api::category.category.update'] } },
    },
    {
      method: 'DELETE',
      path: '/categories/:id',
      handler: 'category.delete',
      config: { auth: { scope: ['api::category.category.delete'] } },
    },
  ],
};
