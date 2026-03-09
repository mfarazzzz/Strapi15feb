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
    }
  ]
};