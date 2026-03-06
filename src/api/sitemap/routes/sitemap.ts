export default {
  routes: [
    {
      method: 'GET',
      path: '/sitemap.xml',
      handler: 'sitemap.sitemapXml',
      config: { auth: false },
    },
  ],
};

