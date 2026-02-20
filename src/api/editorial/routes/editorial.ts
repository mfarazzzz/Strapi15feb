export default {
  routes: [
    {
      method: 'GET',
      path: '/editorials',
      handler: 'editorial.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/editorials/:id',
      handler: 'editorial.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/editorials',
      handler: 'editorial.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/editorials/:id',
      handler: 'editorial.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/editorials/:id',
      handler: 'editorial.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};

