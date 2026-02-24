const { createStrapi } = require('@strapi/strapi');

const ARTICLE_UID = 'api::article.article';
const PAGE_SIZE = 500;

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();

  const nowIso = new Date().toISOString();

  let start = 0;
  let updated = 0;
  while (true) {
    const batch = await strapi.entityService.findMany(ARTICLE_UID, {
      limit: PAGE_SIZE,
      start,
      publicationState: 'preview',
      sort: { createdAt: 'asc' },
      filters: {
        publishedAt: { $null: true },
        scheduledAt: { $null: true },
        $or: [
          { views: { $gt: 0 } },
          { is_featured: true },
          { is_breaking: true },
          { isFeatured: true },
          { isBreaking: true },
          { heroPriority: { $notNull: true } },
        ],
      },
      fields: ['id'],
    });

    const list = Array.isArray(batch) ? batch : [];
    if (list.length === 0) break;

    for (const entity of list) {
      if (!entity?.id) continue;
      await strapi.db.query(ARTICLE_UID).update({
        where: { id: entity.id },
        data: { publishedAt: nowIso },
      });
      updated += 1;
    }

    if (list.length < PAGE_SIZE) break;
    start += list.length;
  }

  console.log(`Backfill complete. Updated: ${updated}. publishedAt set to: ${nowIso}`);
  await strapi.destroy();
};

run().catch((error) => {
  console.error('Backfill missing publishedAt failed:', error);
  process.exit(1);
});

