export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/users',
      handler: 'admin-user.list',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
    {
      method: 'GET',
      path: '/admin/users/:id',
      handler: 'admin-user.findOne',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
    {
      method: 'POST',
      path: '/admin/users',
      handler: 'admin-user.create',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
    {
      method: 'PATCH',
      path: '/admin/users/:id',
      handler: 'admin-user.update',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
    {
      method: 'DELETE',
      path: '/admin/users/:id',
      handler: 'admin-user.delete',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
    {
      method: 'GET',
      path: '/admin/roles',
      handler: 'admin-user.roles',
      config: { auth: {}, policies: ['global::admin-only'] },
    },
  ],
};
