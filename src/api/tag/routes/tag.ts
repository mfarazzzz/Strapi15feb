export default {
  routes: [
    {
      method: 'GET',
      path: '/tags',
      handler: 'tag.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/tags/slug/:slug',
      handler: 'tag.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/tags/:id',
      handler: 'tag.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/tags',
      handler: 'tag.create',
      config: { auth: { scope: ['api::tag.tag.create'] } },
    },
    {
      method: 'PATCH',
      path: '/tags/:id',
      handler: 'tag.update',
      config: { auth: { scope: ['api::tag.tag.update'] } },
    },
    {
      method: 'DELETE',
      path: '/tags/:id',
      handler: 'tag.delete',
      config: { auth: { scope: ['api::tag.tag.delete'] } },
    },
  ],
};
