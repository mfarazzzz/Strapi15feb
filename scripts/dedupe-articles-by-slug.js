const { createStrapi } = require('@strapi/strapi');

const ARTICLE_UID = 'api::article.article';
const PAGE_SIZE = 500;
const APPLY_FIX = String(process.env.APPLY_FIX || '').toLowerCase() === 'true';

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();

  let start = 0;
  const rows = [];
  while (true) {
    const batch = await strapi.entityService.findMany(ARTICLE_UID, {
      publicationState: 'preview',
      sort: [{ updatedAt: 'desc' }],
      fields: ['id', 'documentId', 'slug', 'title', 'updatedAt', 'publishedAt'],
      start,
      limit: PAGE_SIZE,
    });
    const list = Array.isArray(batch) ? batch : [];
    if (list.length === 0) break;
    rows.push(...list);
    if (list.length < PAGE_SIZE) break;
    start += list.length;
  }

  const bySlug = new Map();
  for (const row of rows) {
    const slug = String(row?.slug || '').trim();
    if (!slug) continue;
    const list = bySlug.get(slug) || [];
    list.push(row);
    bySlug.set(slug, list);
  }

  const duplicates = Array.from(bySlug.entries()).filter(([, list]) => list.length > 1);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Duplicate slugs: ${duplicates.length}`);

  for (const [slug, list] of duplicates) {
    const sorted = [...list].sort((a, b) => {
      const at = new Date(a?.updatedAt || 0).getTime();
      const bt = new Date(b?.updatedAt || 0).getTime();
      return bt - at;
    });
    const keeper = sorted[0];
    const toDelete = sorted.slice(1);
    console.log(`slug=${slug} keeper=${keeper?.id} delete=[${toDelete.map((x) => x?.id).join(',')}]`);
    if (APPLY_FIX) {
      for (const item of toDelete) {
        if (!item?.id) continue;
        await strapi.entityService.delete(ARTICLE_UID, item.id);
      }
    }
  }

  console.log(APPLY_FIX ? 'Applied dedupe changes.' : 'Dry run complete. Set APPLY_FIX=true to delete duplicates.');
  await strapi.destroy();
};

run().catch((error) => {
  console.error('Dedupe script failed:', error);
  process.exit(1);
});
