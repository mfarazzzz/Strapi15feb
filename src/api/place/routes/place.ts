export default {
  routes: [
    { method: 'GET',   path: '/places',                handler: 'place.find',       config: { auth: false } },
    { method: 'GET',   path: '/places/slug/:slug',     handler: 'place.findBySlug', config: { auth: false } },
    { method: 'GET',   path: '/places/:id',            handler: 'place.findOne',    config: { auth: false } },
    { method: 'POST',  path: '/places',                handler: 'place.create',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'PATCH', path: '/places/:id',            handler: 'place.update',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/places/:id/publish',    handler: 'place.publish',    config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/places/:id/unpublish',  handler: 'place.unpublish',  config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'DELETE',path: '/places/:id',            handler: 'place.delete',     config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
