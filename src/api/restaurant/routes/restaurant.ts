export default {
  routes: [
    { method: 'GET',   path: '/restaurants',            handler: 'restaurant.find',       config: { auth: false } },
    { method: 'GET',   path: '/restaurants/slug/:slug', handler: 'restaurant.findBySlug', config: { auth: false } },
    { method: 'GET',   path: '/restaurants/:id',        handler: 'restaurant.findOne',    config: { auth: false } },
    { method: 'POST',  path: '/restaurants',            handler: 'restaurant.create',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'PATCH', path: '/restaurants/:id',        handler: 'restaurant.update',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/restaurants/:id/publish',   handler: 'restaurant.publish',   config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/restaurants/:id/unpublish', handler: 'restaurant.unpublish', config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'DELETE',path: '/restaurants/:id',        handler: 'restaurant.delete',     config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
