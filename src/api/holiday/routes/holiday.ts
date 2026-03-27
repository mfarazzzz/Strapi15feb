export default {
  routes: [
    { method: 'GET',   path: '/holidays',            handler: 'holiday.find',       config: { auth: false } },
    { method: 'GET',   path: '/holidays/slug/:slug', handler: 'holiday.findBySlug', config: { auth: false } },
    { method: 'GET',   path: '/holidays/:id',        handler: 'holiday.findOne',    config: { auth: false } },
    { method: 'POST',  path: '/holidays',            handler: 'holiday.create',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'PATCH', path: '/holidays/:id',        handler: 'holiday.update',     config: { auth: {}, policies: ['global::cms-role'] } },
    { method: 'DELETE',path: '/holidays/:id',        handler: 'holiday.delete',     config: { auth: {}, policies: ['global::cms-role'] } },
  ],
};
