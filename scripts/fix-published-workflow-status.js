/**
 * fix-published-workflow-status.js
 *
 * One-time backfill script: finds all articles that are LIVE (published)
 * but have workflowStatus !== 'approved', and updates them to 'approved'.
 *
 * This fixes the root cause where the Document Service publish action does
 * not update custom fields like workflowStatus, leaving published articles
 * with workflowStatus: 'draft' — which caused the frontend to show 404.
 *
 * Run ONCE after deploying the publish handler fix:
 *   node scripts/fix-published-workflow-status.js
 *
 * Or via Strapi CLI:
 *   npx strapi console
 *   > require('./scripts/fix-published-workflow-status.js')
 */

'use strict';

const ARTICLE_UID = 'api::article.article';

async function run() {
  // Find all published articles where workflowStatus is not 'approved'
  const published = await strapi.entityService.findMany(ARTICLE_UID, {
    filters: {
      $and: [
        { publishedAt: { $notNull: true } },
        { workflowStatus: { $ne: 'approved' } },
      ],
    },
    fields: ['id', 'slug', 'workflowStatus', 'publishedAt'],
    limit: 10000,
    publicationState: 'live',
  });

  if (!Array.isArray(published) || published.length === 0) {
    console.log('[fix-published-workflow-status] No articles need fixing.');
    return;
  }

  console.log(`[fix-published-workflow-status] Found ${published.length} published articles with incorrect workflowStatus.`);

  let fixed = 0;
  let failed = 0;

  for (const article of published) {
    try {
      await strapi.entityService.update(ARTICLE_UID, article.id, {
        data: { workflowStatus: 'approved' },
      });
      console.log(`  ✓ Fixed article id=${article.id} slug=${article.slug} (was: ${article.workflowStatus})`);
      fixed++;
    } catch (err) {
      console.error(`  ✗ Failed article id=${article.id} slug=${article.slug}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[fix-published-workflow-status] Done. Fixed: ${fixed}, Failed: ${failed}`);
}

// Support both direct execution and require()
if (require.main === module) {
  // Direct execution — need to bootstrap Strapi first
  const strapi = require('@strapi/strapi').createStrapi();
  strapi.start().then(async () => {
    try {
      await run();
    } finally {
      await strapi.destroy();
    }
  });
} else {
  // Called from Strapi console or another script
  module.exports = run;
}
