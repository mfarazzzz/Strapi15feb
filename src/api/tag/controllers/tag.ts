import { factories } from '@strapi/strapi';

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
  };
};

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
}));
