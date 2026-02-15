export default {
  routes: [
    {
      method: 'GET',
      path: '/authors',
      handler: 'author.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/authors/:id',
      handler: 'author.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/authors',
      handler: 'author.create',
      config: { auth: { scope: ['api::author.author.create'] } },
    },
    {
      method: 'PATCH',
      path: '/authors/:id',
      handler: 'author.update',
      config: { auth: { scope: ['api::author.author.update'] } },
    },
    {
      method: 'DELETE',
      path: '/authors/:id',
      handler: 'author.delete',
      config: { auth: { scope: ['api::author.author.delete'] } },
    },
  ],
};
