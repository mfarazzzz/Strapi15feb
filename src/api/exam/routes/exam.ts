export default {
  routes: [
    {
      method: 'GET',
      path: '/exams',
      handler: 'exam.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/exams/upcoming',
      handler: 'exam.upcoming',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/exams/slug/:slug',
      handler: 'exam.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/exams/:id',
      handler: 'exam.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/exams',
      handler: 'exam.create',
      config: { auth: {} },
    },
    {
      method: 'PATCH',
      path: '/exams/:id',
      handler: 'exam.update',
      config: { auth: {} },
    },
    {
      method: 'DELETE',
      path: '/exams/:id',
      handler: 'exam.delete',
      config: { auth: {} },
    },
  ],
};
