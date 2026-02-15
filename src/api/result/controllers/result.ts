import { factories } from '@strapi/strapi';

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const parseLimit = (value: unknown, fallback: number) => {
  const limit = parseNumber(value) ?? fallback;
  if (limit <= 0) return fallback;
  return Math.min(limit, 100);
};

const normalizeResult = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

export default factories.createCoreController('api::result.result' as any, ({ strapi }) => ({
  async recent(ctx) {
    const limit = parseLimit(ctx.query.limit, 25);

    const entities = await (strapi.entityService as any).findMany('api::result.result', {
      filters: { status: 'declared' },
      sort: { resultDate: 'desc' },
      populate: { image: true },
      publicationState: 'live',
      limit,
    });

    return (entities as any[]).map(normalizeResult);
  },

  async find(ctx) {
    const entities = await (strapi.entityService as any).findMany('api::result.result', {
      sort: { resultDate: 'desc' },
      populate: { image: true },
      publicationState: 'live',
      limit: 1000,
    });
    return (entities as any[]).map(normalizeResult);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::result.result', id, {
      populate: { image: true },
      publicationState: 'live',
    });
    if (!entity) {
      ctx.notFound('Result not found');
      return;
    }
    return normalizeResult(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::result.result', {
      filters: { slug },
      populate: { image: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Result not found');
      return;
    }
    return normalizeResult(entity);
  },

  async create(ctx) {
    const body = ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).create('api::result.result', {
      data: body,
      populate: { image: true },
    });
    return normalizeResult(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).update('api::result.result', id, {
      data: body,
      populate: { image: true },
    });
    return normalizeResult(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::result.result', id);
    ctx.status = 204;
  },
}));
