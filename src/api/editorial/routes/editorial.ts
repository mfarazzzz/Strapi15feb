export default {
  routes: [
    // ─── Admin routes (authenticated, cms-role policy) ──────────────────────
    {
      method: 'GET',
      path: '/editorials/admin',
      handler: 'editorial.adminFind',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'GET',
      path: '/editorials/admin/slug/:slug',
      handler: 'editorial.adminFindBySlug',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'GET',
      path: '/editorials/admin/:id',
      handler: 'editorial.adminFindOne',
      config: { auth: {}, policies: ['global::cms-role'] },
    },

    // ─── Public routes (no auth required) ──────────────────────────────────
    {
      method: 'GET',
      path: '/editorials',
      handler: 'editorial.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/editorials/slug/:slug',
      handler: 'editorial.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/editorials/:id',
      handler: 'editorial.findOne',
      config: { auth: false },
    },

    // ─── Write routes (authenticated, cms-role policy) ──────────────────────
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
