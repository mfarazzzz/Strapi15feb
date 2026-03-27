export default {
  routes: [
    { method: 'GET',   path: '/cms-users',     handler: 'cms-user.find',    config: { auth: {}, policies: ['global::admin-only'] } },
    { method: 'GET',   path: '/cms-users/:id', handler: 'cms-user.findOne', config: { auth: {}, policies: ['global::admin-only'] } },
    { method: 'POST',  path: '/cms-users',     handler: 'cms-user.create',  config: { auth: {}, policies: ['global::admin-only'] } },
    { method: 'PATCH', path: '/cms-users/:id', handler: 'cms-user.update',  config: { auth: {}, policies: ['global::admin-only'] } },
    { method: 'DELETE',path: '/cms-users/:id', handler: 'cms-user.delete',  config: { auth: {}, policies: ['global::admin-only'] } },
    // Self-lookup: any authenticated CMS user can fetch their own role
    { method: 'GET',   path: '/cms-users/me',  handler: 'cms-user.me',      config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
