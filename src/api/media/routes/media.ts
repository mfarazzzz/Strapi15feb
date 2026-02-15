export default {
  routes: [
    {
      method: 'GET',
      path: '/media',
      handler: 'media.find',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/media',
      handler: 'media.create',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/media/:id',
      handler: 'media.delete',
      config: { auth: false },
    },
  ],
};
