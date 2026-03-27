import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::cms-user.cms-user' as any, ({ strapi }) => ({
  async find(ctx) {
    const entities = await (strapi.entityService as any).findMany('api::cms-user.cms-user', {
      populate: { user: { fields: ['id', 'username', 'email'] } },
    });
    return entities;
  },

  async findOne(ctx) {
    const entity = await (strapi.entityService as any).findOne('api::cms-user.cms-user', ctx.params.id, {
      populate: { user: { fields: ['id', 'username', 'email'] } },
    });
    if (!entity) { ctx.notFound(); return; }
    return entity;
  },

  async create(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).create('api::cms-user.cms-user', {
      data: body,
      populate: { user: { fields: ['id', 'username', 'email'] } },
    });
    return entity;
  },

  async update(ctx) {
    const body = ctx.request.body?.data ?? ctx.request.body ?? {};
    const entity = await (strapi.entityService as any).update('api::cms-user.cms-user', ctx.params.id, {
      data: body,
      populate: { user: { fields: ['id', 'username', 'email'] } },
    });
    return entity;
  },

  async delete(ctx) {
    await (strapi.entityService as any).delete('api::cms-user.cms-user', ctx.params.id);
    ctx.status = 204;
  },

  /** GET /cms-users/me — returns the CMS role for the currently authenticated user */
  async me(ctx) {
    const userId = ctx.state?.user?.id;
    if (!userId) { ctx.unauthorized(); return; }

    const results = await (strapi.entityService as any).findMany('api::cms-user.cms-user', {
      filters: { user: { id: userId }, isActive: true },
      populate: { user: { fields: ['id', 'username', 'email'] } },
      limit: 1,
    });

    const cmsUser = Array.isArray(results) ? results[0] : null;
    if (!cmsUser) {
      // User exists in Strapi but has no CMS role assigned — default to writer
      return { role: 'writer', isActive: true };
    }
    return cmsUser;
  },
}));
