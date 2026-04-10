import { factories } from '@strapi/strapi';

const SEO_THRESHOLD = 3; // tags with fewer articles are noindex

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
    // Expose noindex so the frontend can add <meta name="robots" content="noindex">
    // on tag pages that don't yet have enough articles to be SEO-worthy.
    noindex: entity.noindex ?? (typeof entity.articleCount === 'number'
      ? entity.articleCount < SEO_THRESHOLD
      : true),
  };
};

/**
 * Recount articles for a tag and update articleCount + noindex in one write.
 * Called after any article create/update/delete that touches tags.
 */
export async function recalcTagCount(strapi: any, tagId: number): Promise<void> {
  try {
    const es = strapi.entityService as any;
    const articles = await es.findMany('api::article.article', {
      filters: { tags: { id: { $eq: tagId } }, publishedAt: { $notNull: true } },
      fields: ['id'],
      limit: 1000,
    });
    const count = Array.isArray(articles) ? articles.length : 0;
    await es.update('api::tag.tag', tagId, {
      data: {
        articleCount: count,
        noindex: count < SEO_THRESHOLD,
      },
    });
  } catch {
    // Non-fatal — tag count is best-effort
  }
}

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
    if (!entity) {
      ctx.notFound('Tag not found');
      return;
    }
    return normalizeTag(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await strapi.entityService.findMany('api::tag.tag', {
      filters: { slug },
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Tag not found');
      return;
    }
    return normalizeTag(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);
    const entity = await strapi.entityService.create('api::tag.tag', {
      data: body,
    });
    return normalizeTag(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await strapi.entityService.update('api::tag.tag', id, {
      data: body,
    });
    return normalizeTag(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete('api::tag.tag', id);
    ctx.status = 204;
  },

  /**
   * POST /tags/:id/recalc-count
   * Recalculates articleCount and noindex for a single tag.
   * Called by the CMS after bulk operations.
   */
  async recalcCount(ctx) {
    const id = Number(ctx.params.id);
    if (!id) { ctx.badRequest('Invalid id'); return; }
    await recalcTagCount(strapi, id);
    const updated = await strapi.entityService.findOne('api::tag.tag', id);
    return normalizeTag(updated);
  },
}));
