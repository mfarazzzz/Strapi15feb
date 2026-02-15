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
      config: { auth: {} },
    },
    {
      method: 'PATCH',
      path: '/pages/:id',
      handler: 'page.update',
      config: { auth: {} },
    },
    {
      method: 'DELETE',
      path: '/pages/:id',
      handler: 'page.delete',
      config: { auth: {} },
    },
  ],
};
