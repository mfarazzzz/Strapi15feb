import { factories } from '@strapi/strapi';

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

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

const normalizeExam = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

export default factories.createCoreController('api::exam.exam' as any, ({ strapi }) => ({
  async upcoming(ctx) {
    const limit = parseLimit(ctx.query.limit, 25);
    const today = new Date().toISOString().slice(0, 10);

    const entities = await (strapi.entityService as any).findMany('api::exam.exam', {
      filters: {
        $or: [{ status: 'upcoming' }, { examDate: { $gte: today } }],
      },
      sort: { examDate: 'asc' },
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
      publicationState: 'live',
      limit,
    });

    return (entities as any[]).map(normalizeExam);
  },

  async find(ctx) {
    const entities = await (strapi.entityService as any).findMany('api::exam.exam', {
      sort: { examDate: 'asc' },
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
      publicationState: 'live',
      limit: 1000,
    });

    return (entities as any[]).map(normalizeExam);
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::exam.exam', id, {
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
      publicationState: 'live',
    });
    if (!entity) {
      ctx.notFound('Exam not found');
      return;
    }
    return normalizeExam(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::exam.exam', {
      filters: { slug },
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Exam not found');
      return;
    }
    return normalizeExam(entity);
  },

  async create(ctx) {
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::exam.exam', {
      data: body,
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
    });
    return normalizeExam(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::exam.exam', id, {
      data: body,
      populate: {
        image: true,
        seo: { populate: { ogImage: true } },
      },
    });
    return normalizeExam(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::exam.exam', id);
    ctx.status = 204;
  },
}));
