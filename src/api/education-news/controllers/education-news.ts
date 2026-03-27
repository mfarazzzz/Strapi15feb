import { factories } from '@strapi/strapi';

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const normalizeEducationNews = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  const normalized: any = {
    id: String(id),
    ...rest,
  };

  if (!normalized.titleHindi && normalized.title) normalized.titleHindi = normalized.title;
  if (!normalized.excerptHindi && normalized.excerpt) normalized.excerptHindi = normalized.excerpt;
  if (!normalized.contentHindi && normalized.content) normalized.contentHindi = normalized.content;

  if (typeof normalized.updatedAt === 'string') {
    normalized.lastUpdated = normalized.updatedAt;
  }

  if (!normalized.seoTitle && normalized.titleHindi) normalized.seoTitle = normalized.titleHindi;
  if (!normalized.seoDescription && normalized.excerptHindi) normalized.seoDescription = normalized.excerptHindi;

  return normalized;
};

export default factories.createCoreController('api::education-news.education-news' as any, ({ strapi }) => ({
  async find(ctx) {
    const limit = Math.min(Number(ctx.query?.['pagination[limit]'] ?? 25), 100);
    const offset = Number(ctx.query?.['pagination[start]'] ?? 0);
    const entities = await (strapi.entityService as any).findMany('api::education-news.education-news', {
      sort: { publishedAt: 'desc' },
      populate: { image: true },
      publicationState: 'live',
      limit,
      offset,
    });
    return (entities as any[]).map(normalizeEducationNews);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::education-news.education-news', id, {
      populate: { image: true },
      publicationState: 'live',
    });
    if (!entity) {
      ctx.notFound('Education news not found');
      return;
    }
    return normalizeEducationNews(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::education-news.education-news', {
      filters: { slug },
      sort: { publishedAt: 'desc' },
      populate: { image: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Education news not found');
      return;
    }
    return normalizeEducationNews(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::education-news.education-news', {
      data: body,
      populate: { image: true },
    });
    return normalizeEducationNews(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::education-news.education-news', id, {
      data: body,
      populate: { image: true },
    });
    return normalizeEducationNews(entity);
  },

  async publish(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).update('api::education-news.education-news', id, {
      data: { publishedAt: new Date().toISOString() },
      populate: { image: true },
    });
    return normalizeEducationNews(entity);
  },

  async unpublish(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).update('api::education-news.education-news', id, {
      data: { publishedAt: null },
      populate: { image: true },
    });
    return normalizeEducationNews(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::education-news.education-news', id);
    ctx.status = 204;
  },
}));

