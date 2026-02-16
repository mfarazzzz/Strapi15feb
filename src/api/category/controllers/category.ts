import { factories } from '@strapi/strapi';

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const normalizeCategory = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
  async find(ctx) {
    const entities = await strapi.entityService.findMany('api::category.category', {
      sort: { order: 'asc' },
      limit: 1000,
    });
    return (entities as any[]).map(normalizeCategory);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await strapi.entityService.findOne('api::category.category', id);
    if (!entity) {
      ctx.notFound('Category not found');
      return;
    }
    return normalizeCategory(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await strapi.entityService.findMany('api::category.category', {
      filters: { slug },
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Category not found');
      return;
    }
    return normalizeCategory(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);
    const entity = await strapi.entityService.create('api::category.category', {
      data: body,
    });
    return normalizeCategory(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await strapi.entityService.update('api::category.category', id, {
      data: body,
    });
    return normalizeCategory(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete('api::category.category', id);
    ctx.status = 204;
  },
}));

