export default {
  routes: [
    {
      method: 'GET',
      path: '/mediaitems',
      handler: 'mediaitem.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/mediaitems/:id',
      handler: 'mediaitem.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/mediaitems',
      handler: 'mediaitem.create',
      config: { auth: {} },
    },
    {
      method: 'PATCH',
      path: '/mediaitems/:id',
      handler: 'mediaitem.update',
      config: { auth: {} },
    },
    {
      method: 'DELETE',
      path: '/mediaitems/:id',
      handler: 'mediaitem.delete',
      config: { auth: {} },
    },
  ],
};
