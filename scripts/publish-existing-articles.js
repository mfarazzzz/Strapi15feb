const { createStrapi } = require('@strapi/strapi');

const ARTICLE_UID = 'api::article.article';
const PAGE_SIZE = 500;

const isTruthy = (value) => {
  if (value === true) return true;
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
};

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();

  const dryRun = isTruthy(process.env.DRY_RUN);

  let start = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const batch = await strapi.db.query(ARTICLE_UID).findMany({
      where: {
        publishedAt: null,
      },
      select: ['id', 'createdAt', 'updatedAt', 'title', 'slug'],
      orderBy: { createdAt: 'asc' },
      offset: start,
      limit: PAGE_SIZE,
    });

    if (!batch || batch.length === 0) break;

    for (const row of batch) {
      scanned += 1;
      const publishedAt = row?.createdAt || row?.updatedAt || new Date().toISOString();
      if (!row?.id) continue;

      if (!dryRun) {
        await strapi.db.query(ARTICLE_UID).update({
          where: { id: row.id },
          data: { publishedAt },
        });
      }
      updated += 1;
    }

    if (batch.length < PAGE_SIZE) break;
    start += batch.length;
  }

  const mode = dryRun ? 'DRY_RUN' : 'LIVE';
  console.log(`[${mode}] Scanned: ${scanned}, Published: ${updated}`);
  await strapi.destroy();
};

run().catch((error) => {
  console.error('Publish existing articles failed:', error);
  process.exit(1);
});

