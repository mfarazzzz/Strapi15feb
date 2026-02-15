export default {
  routes: [
    {
      method: 'GET',
      path: '/settings',
      handler: 'sitesetting.get',
      config: { auth: false },
    },
    {
      method: 'PATCH',
      path: '/settings',
      handler: 'sitesetting.updateSettings',
      config: { auth: {}, policies: ['global::cms-role'] },
    },
  ],
};
