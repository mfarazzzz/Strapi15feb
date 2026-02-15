export default {
  routes: [
    {
      method: 'GET',
      path: '/results/recent',
      handler: 'result.recent',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/results',
      handler: 'result.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/results/slug/:slug',
      handler: 'result.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/results/:id',
      handler: 'result.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/results',
      handler: 'result.create',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/results/:id',
      handler: 'result.update',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/results/:id',
      handler: 'result.delete',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
