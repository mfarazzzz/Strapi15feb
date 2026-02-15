import { factories } from '@strapi/strapi';

const normalizePage = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

export default factories.createCoreController('api::page.page', ({ strapi }) => ({
  async find(ctx) {
    const entities = await strapi.entityService.findMany('api::page.page', {
      sort: { order: 'asc' },
      limit: 1000,
    });
    return (entities as any[]).map(normalizePage).filter(Boolean);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await strapi.entityService.findOne('api::page.page', id);
    if (!entity) {
      ctx.notFound('Page not found');
      return;
    }
    return normalizePage(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await strapi.entityService.findMany('api::page.page', {
      filters: { slug },
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Page not found');
      return;
    }
    return normalizePage(entity);
  },

  async create(ctx) {
    const body = ctx.request.body ?? {};
    const value = body?.data && typeof body.data === 'object' ? body.data : body;
    const entity = await strapi.entityService.create('api::page.page', {
      data: value,
    });
    return normalizePage(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = ctx.request.body ?? {};
    const value = body?.data && typeof body.data === 'object' ? body.data : body;
    const entity = await strapi.entityService.update('api::page.page', id, {
      data: value,
    });
    return normalizePage(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete('api::page.page', id);
    ctx.status = 204;
  },
}));

