export default {
  routes: [
    { method: 'GET',   path: '/events',                handler: 'event.find',       config: { auth: false } },
    { method: 'GET',   path: '/events/upcoming',       handler: 'event.upcoming',   config: { auth: false } },
    { method: 'GET',   path: '/events/slug/:slug',     handler: 'event.findBySlug', config: { auth: false } },
    { method: 'GET',   path: '/events/:id',            handler: 'event.findOne',    config: { auth: false } },
    { method: 'POST',  path: '/events',                handler: 'event.create',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'PATCH', path: '/events/:id',            handler: 'event.update',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/events/:id/publish',    handler: 'event.publish',    config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/events/:id/unpublish',  handler: 'event.unpublish',  config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'DELETE',path: '/events/:id',            handler: 'event.delete',     config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
