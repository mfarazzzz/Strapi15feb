import { factories } from '@strapi/strapi';

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const normalizeMediaItem = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

export default factories.createCoreController('api::mediaitem.mediaitem' as any, ({ strapi }) => ({
  async find(ctx) {
    const entities = await (strapi.entityService as any).findMany('api::mediaitem.mediaitem', {
      sort: { createdAt: 'desc' },
      populate: {
        file: true,
        uploadedBy: { populate: { avatar: true } },
      },
      limit: 1000,
    });
    return (entities as any[]).map(normalizeMediaItem);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::mediaitem.mediaitem', id, {
      populate: {
        file: true,
        uploadedBy: { populate: { avatar: true } },
      },
    });
    if (!entity) {
      ctx.notFound('MediaItem not found');
      return;
    }
    return normalizeMediaItem(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::mediaitem.mediaitem', {
      data: body,
      populate: {
        file: true,
        uploadedBy: { populate: { avatar: true } },
      },
    });
    return normalizeMediaItem(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::mediaitem.mediaitem', id, {
      data: body,
      populate: {
        file: true,
        uploadedBy: { populate: { avatar: true } },
      },
    });
    return normalizeMediaItem(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::mediaitem.mediaitem', id);
    ctx.status = 204;
  },
}));
