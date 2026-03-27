import { factories } from '@strapi/strapi';

const normalizeHoliday = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  const normalized: any = { id: String(id), ...rest };
  if (normalized.image?.url) normalized.image = normalized.image.url;
  return normalized;
};

export default factories.createCoreController('api::holiday.holiday' as any, ({ strapi }) => ({
  async find(ctx) {
    const limit = Math.min(Number(ctx.query?.['pagination[limit]'] ?? 100), 200);
    const offset = Number(ctx.query?.['pagination[start]'] ?? 0);
    const entities = await (strapi.entityService as any).findMany('api::holiday.holiday', {
      sort: { date: 'asc' },
      populate: { image: true },
      limit,
      offset,
    });
    return (entities as any[]).map(normalizeHoliday);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::holiday.holiday', id, {
      populate: { image: true },
    });
    if (!entity) { ctx.notFound('Holiday not found'); return; }
    return normalizeHoliday(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::holiday.holiday', {
      filters: { slug },
      populate: { image: true },
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Holiday not found'); return; }
    return normalizeHoliday(entity);
  },

  async create(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).create('api::holiday.holiday', {
      data: body,
      populate: { image: true },
    });
    return normalizeHoliday(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).update('api::holiday.holiday', id, {
      data: body,
      populate: { image: true },
    });
    return normalizeHoliday(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::holiday.holiday', id);
    ctx.status = 204;
  },
}));
