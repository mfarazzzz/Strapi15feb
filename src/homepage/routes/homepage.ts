export default {
  routes: [
    {
      method: 'GET',
      path: '/homepage',
      handler: 'homepage.index',
      config: {
        auth: false,
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/healthz',
      handler: 'homepage.health',
      config: {
        auth: false,
        policies: []
      }
    }
  ]
};
