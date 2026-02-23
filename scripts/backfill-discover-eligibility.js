const { createStrapi } = require('@strapi/strapi');

const ARTICLE_UID = 'api::article.article';
const PAGE_SIZE = 500;

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();

  let start = 0;
  let updated = 0;
  while (true) {
    const batch = await strapi.entityService.findMany(ARTICLE_UID, {
      limit: PAGE_SIZE,
      start,
      publicationState: 'live',
      populate: { featured_image: true },
      sort: { publishedAt: 'desc' },
    });
    const list = Array.isArray(batch) ? batch : [];
    if (list.length === 0) break;

    for (const entity of list) {
      const width = typeof entity?.featured_image?.width === 'number' ? entity.featured_image.width : 0;
      const eligible = width >= 1200;
      if (entity?.discoverEligible !== eligible) {
        await strapi.db.query(ARTICLE_UID).update({
          where: { id: entity.id },
          data: { discoverEligible: eligible },
        });
        updated += 1;
      }
    }

    if (list.length < PAGE_SIZE) break;
    start += list.length;
  }

  console.log(`Discover eligibility backfill complete. Updated: ${updated}`);
  await strapi.destroy();
};

run().catch((error) => {
  console.error('Discover eligibility backfill failed:', error);
  process.exit(1);
});
