
const { createStrapi } = require('@strapi/strapi');

async function check() {
  const strapi = await createStrapi();
  await strapi.load();

  try {
    const count = await strapi.db.query('api::article.article').count();
    console.log('Total articles in DB:', count);

    const publishedCount = await strapi.db.query('api::article.article').count({
      where: {
        publishedAt: { $notNull: true }
      }
    });
    console.log('Published articles (db.query):', publishedCount);

    const esCount = await strapi.entityService.count('api::article.article', {
      publicationState: 'live'
    });
    console.log('Published articles (entityService):', esCount);

    const first = await strapi.entityService.findMany('api::article.article', {
      limit: 1,
      publicationState: 'preview'
    });
    console.log('First article (preview):', JSON.stringify(first[0], null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await strapi.destroy();
  }
}

check();
