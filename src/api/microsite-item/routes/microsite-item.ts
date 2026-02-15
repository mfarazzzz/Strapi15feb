export default {
  routes: [
    {
      method: 'GET',
      path: '/microsite-items',
      handler: 'microsite-item.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/microsite-items/slug/:slug',
      handler: 'microsite-item.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/microsite-items/:id',
      handler: 'microsite-item.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/microsite-items',
      handler: 'microsite-item.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/microsite-items/:id',
      handler: 'microsite-item.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/microsite-items/:id',
      handler: 'microsite-item.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
