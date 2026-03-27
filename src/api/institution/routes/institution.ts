export default {
  routes: [
    { method: 'GET',   path: '/institutions',            handler: 'institution.find',       config: { auth: false } },
    { method: 'GET',   path: '/institutions/slug/:slug', handler: 'institution.findBySlug', config: { auth: false } },
    { method: 'GET',   path: '/institutions/:id',        handler: 'institution.findOne',    config: { auth: false } },
    { method: 'POST',  path: '/institutions',            handler: 'institution.create',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'PATCH', path: '/institutions/:id',        handler: 'institution.update',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/institutions/:id/publish',   handler: 'institution.publish',   config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'POST',  path: '/institutions/:id/unpublish', handler: 'institution.unpublish', config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'DELETE',path: '/institutions/:id',        handler: 'institution.delete',     config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
