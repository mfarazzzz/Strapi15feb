import { factories } from '@strapi/strapi';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEO_THRESHOLD = 3;
const RECENT_HOURS = 48;

/** Tokens that make a tag low-value for SEO regardless of position in slug */
const LOW_VALUE_TOKENS = new Set([
  'news', 'latest', 'today', 'update', 'updates', 'breaking',
  'live', 'top', 'new', 'recent', 'current',
]);

/** Score assigned by tagType */
const TYPE_SCORES: Record<string, number> = {
  primary: 100,
  secondary: 50,
  derived: 30,
};

// ─── Root-entity detection ─────────────────────────────────────────────────────

/**
 * Detect whether a slug represents a root entity (location or category).
 * Root entities get canonicalTagId = their own id (self-canonical).
 * Rule: slug has no generic tokens AND is a single word (no hyphens).
 */
const isRootEntity = (slug: string): boolean => {
  const parts = slug.split('-');
  if (parts.length > 2) return false; // multi-word → not a root entity
  return !parts.some((p) => LOW_VALUE_TOKENS.has(p.toLowerCase()));
};

/**
 * Normalize a slug to its canonical form by stripping low-value suffix tokens.
 * e.g. "rampur-news" → "rampur", "up-latest-updates" → "up"
 */
const normalizeSlugToCanonical = (slug: string): string => {
  const parts = slug.split('-');
  const meaningful = parts.filter((p) => !LOW_VALUE_TOKENS.has(p.toLowerCase()));
  return meaningful.length > 0 ? meaningful.join('-') : slug;
};

// ─── Low-value filter ─────────────────────────────────────────────────────────

/**
 * Returns true if the slug contains any generic token — even as part of a
 * multi-word slug like "rampur-news-today".
 */
export const isLowValueSlug = (slug: string): boolean => {
  const parts = slug.split('-');
  return parts.some((p) => LOW_VALUE_TOKENS.has(p.toLowerCase()));
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const normalizeTag = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
    noindex: entity.noindex ?? (typeof entity.articleCount === 'number'
      ? entity.articleCount < SEO_THRESHOLD
      : true),
  };
};

// ─── Batch tag-count update ────────────────────────────────────────────────────

/**
 * Recalculate articleCount, recentArticleCount, noindex, and score for ALL tags
 * in a single batch using raw SQL aggregation — no per-tag loop.
 *
 * Called after any article publish/unpublish/delete that touches tags.
 */
export async function batchRecalcAllTagCounts(strapi: any): Promise<void> {
  try {
    const knex = strapi.db.connection;
    const cutoff = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();

    // One query: total published articles per tag
    const totalRows: Array<{ tag_id: number; cnt: number }> = await knex.raw(`
      SELECT atj.tag_id, COUNT(DISTINCT a.id) AS cnt
      FROM articles_tags_lnk atj
      JOIN articles a ON a.id = atj.article_id
      WHERE a.published_at IS NOT NULL
      GROUP BY atj.tag_id
    `).then((r: any) => r.rows ?? r[0] ?? []);

    // One query: recent published articles per tag (last 48h)
    const recentRows: Array<{ tag_id: number; cnt: number }> = await knex.raw(`
      SELECT atj.tag_id, COUNT(DISTINCT a.id) AS cnt
      FROM articles_tags_lnk atj
      JOIN articles a ON a.id = atj.article_id
      WHERE a.published_at IS NOT NULL AND a.published_at >= ?
      GROUP BY atj.tag_id
    `, [cutoff]).then((r: any) => r.rows ?? r[0] ?? []);

    // Build lookup maps
    const totalMap = new Map<number, number>();
    for (const row of totalRows) totalMap.set(Number(row.tag_id), Number(row.cnt));

    const recentMap = new Map<number, number>();
    for (const row of recentRows) recentMap.set(Number(row.tag_id), Number(row.cnt));

    // Fetch all tags (id + tagType + slug) for score + noindex computation
    const tags: Array<{ id: number; tagType: string; slug: string }> =
      await strapi.entityService.findMany('api::tag.tag', {
        fields: ['id', 'tagType', 'slug'],
        limit: 10000,
      });

    if (!Array.isArray(tags) || tags.length === 0) return;

    // Bulk update via a single transaction
    await knex.transaction(async (trx: any) => {
      for (const tag of tags) {
        const id = Number(tag.id);
        const total = totalMap.get(id) ?? 0;
        const recent = recentMap.get(id) ?? 0;
        const typeScore = TYPE_SCORES[tag.tagType] ?? TYPE_SCORES.secondary;
        const noindex = total < SEO_THRESHOLD || isLowValueSlug(tag.slug ?? '');

        await trx('tags')
          .where({ id })
          .update({
            article_count: total,
            recent_article_count: recent,
            noindex,
            score: typeScore,
          });
      }
    });
  } catch (err) {
    // Non-fatal — tag counts are best-effort
    strapi.log?.warn?.(`batchRecalcAllTagCounts failed: ${err}`);
  }
}

/**
 * Recalculate a single tag (used for the manual /recalc-count endpoint).
 * Still efficient: two targeted queries instead of a full table scan.
 */
export async function recalcTagCount(strapi: any, tagId: number): Promise<void> {
  try {
    const knex = strapi.db.connection;
    const cutoff = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000).toISOString();

    const [totalRow] = await knex.raw(`
      SELECT COUNT(DISTINCT a.id) AS cnt
      FROM articles_tags_lnk atj
      JOIN articles a ON a.id = atj.article_id
      WHERE atj.tag_id = ? AND a.published_at IS NOT NULL
    `, [tagId]).then((r: any) => r.rows ?? r[0] ?? []);

    const [recentRow] = await knex.raw(`
      SELECT COUNT(DISTINCT a.id) AS cnt
      FROM articles_tags_lnk atj
      JOIN articles a ON a.id = atj.article_id
      WHERE atj.tag_id = ? AND a.published_at IS NOT NULL AND a.published_at >= ?
    `, [tagId, cutoff]).then((r: any) => r.rows ?? r[0] ?? []);

    const tag = await strapi.entityService.findOne('api::tag.tag', tagId, {
      fields: ['tagType', 'slug'],
    });

    const total = Number(totalRow?.cnt ?? 0);
    const recent = Number(recentRow?.cnt ?? 0);
    const typeScore = TYPE_SCORES[tag?.tagType] ?? TYPE_SCORES.secondary;
    const noindex = total < SEO_THRESHOLD || isLowValueSlug(tag?.slug ?? '');

    await strapi.entityService.update('api::tag.tag', tagId, {
      data: {
        articleCount: total,
        recentArticleCount: recent,
        noindex,
        score: typeScore,
      },
    });
  } catch (err) {
    strapi.log?.warn?.(`recalcTagCount(${tagId}) failed: ${err}`);
  }
}

// ─── Hybrid canonical resolution ──────────────────────────────────────────────

/**
 * Resolve the canonical tag for a given slug:
 * 1. If a manual canonicalTagId is set → use it.
 * 2. Otherwise, derive the canonical slug by stripping low-value tokens,
 *    look up that slug in the DB, and return its id (or self if not found).
 */
export async function resolveCanonicalTagId(
  strapi: any,
  tagId: number,
  slug: string,
  manualCanonicalTagId?: number | null,
): Promise<number> {
  // Manual override wins
  if (manualCanonicalTagId && manualCanonicalTagId !== tagId) {
    return manualCanonicalTagId;
  }

  // Rule-based: derive canonical slug
  const canonicalSlug = normalizeSlugToCanonical(slug);
  if (canonicalSlug === slug) return tagId; // already canonical

  const matches = await strapi.entityService.findMany('api::tag.tag', {
    filters: { slug: canonicalSlug },
    fields: ['id'],
    limit: 1,
  });
  const match = Array.isArray(matches) ? matches[0] : null;
  return match ? Number(match.id) : tagId;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({

  async find(ctx) {
    const entities = await strapi.entityService.findMany('api::tag.tag', {
      sort: { name: 'asc' } as any,
      limit: 1000,
    });
    return (entities as any[]).map(normalizeTag);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await strapi.entityService.findOne('api::tag.tag', id);
    if (!entity) { ctx.notFound('Tag not found'); return; }
    return normalizeTag(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await strapi.entityService.findMany('api::tag.tag', {
      filters: { slug },
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Tag not found'); return; }
    return normalizeTag(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);

    // Reject low-value slugs at creation time
    const slug = body.slug || '';
    if (slug && isLowValueSlug(slug)) {
      ctx.badRequest(`Tag slug "${slug}" contains generic tokens (${[...LOW_VALUE_TOKENS].join(', ')})`);
      return;
    }

    // Auto-assign score from tagType
    if (body.tagType && !body.score) {
      body.score = TYPE_SCORES[body.tagType] ?? TYPE_SCORES.secondary;
    }

    const entity = await strapi.entityService.create('api::tag.tag', { data: body });

    // Resolve canonical after creation
    const canonicalTagId = await resolveCanonicalTagId(
      strapi,
      Number(entity.id),
      entity.slug ?? '',
      body.canonicalTagId ?? null,
    );
    if (canonicalTagId !== Number(entity.id)) {
      await strapi.entityService.update('api::tag.tag', entity.id, {
        data: { canonicalTagId },
      });
      (entity as any).canonicalTagId = canonicalTagId;
    }

    return normalizeTag(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);

    // Auto-assign score from tagType if changed
    if (body.tagType && !body.score) {
      body.score = TYPE_SCORES[body.tagType] ?? TYPE_SCORES.secondary;
    }

    const entity = await strapi.entityService.update('api::tag.tag', id, { data: body });

    // Re-resolve canonical if slug or canonicalTagId changed
    if (body.slug !== undefined || body.canonicalTagId !== undefined) {
      const canonicalTagId = await resolveCanonicalTagId(
        strapi,
        Number(id),
        entity.slug ?? '',
        body.canonicalTagId ?? (entity as any).canonicalTagId ?? null,
      );
      if (canonicalTagId !== Number(id) || (entity as any).canonicalTagId !== canonicalTagId) {
        await strapi.entityService.update('api::tag.tag', id, {
          data: { canonicalTagId },
        });
        (entity as any).canonicalTagId = canonicalTagId;
      }
    }

    return normalizeTag(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete('api::tag.tag', id);
    ctx.status = 204;
  },

  /**
   * POST /tags/:id/recalc-count
   * Recalculates a single tag's counts + score.
   */
  async recalcCount(ctx) {
    const id = Number(ctx.params.id);
    if (!id) { ctx.badRequest('Invalid id'); return; }
    await recalcTagCount(strapi, id);
    const updated = await strapi.entityService.findOne('api::tag.tag', id);
    return normalizeTag(updated);
  },

  /**
   * POST /tags/batch-recalc
   * Recalculates ALL tags in one batch DB operation.
   * Intended for scheduled jobs or post-bulk-import runs.
   */
  async batchRecalc(ctx) {
    await batchRecalcAllTagCounts(strapi);
    ctx.body = { ok: true, message: 'Batch recalc triggered' };
  },
}));
