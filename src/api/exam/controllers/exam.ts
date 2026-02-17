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
  const normalized: any = {
    id: String(id),
    ...rest,
  };

  if (!normalized.titleHindi && normalized.title) {
    normalized.titleHindi = normalized.title;
  }
  if (!normalized.organizationHindi && normalized.organization) {
    normalized.organizationHindi = normalized.organization;
  }

  const today = new Date().toISOString().slice(0, 10);
  const examDate = typeof normalized.examDate === 'string' ? normalized.examDate : null;

  if (!normalized.status && examDate) {
    if (examDate > today) normalized.status = 'upcoming';
    else if (examDate < today) normalized.status = 'completed';
    else normalized.status = 'ongoing';
  }

  if (!normalized.applicationStatus) {
    const start = typeof normalized.applicationStartDate === 'string' ? normalized.applicationStartDate : null;
    const end = typeof normalized.applicationEndDate === 'string' ? normalized.applicationEndDate : null;
    if (start && start > today) normalized.applicationStatus = 'upcoming';
    else if (end && end < today) normalized.applicationStatus = 'closed';
    else if (start || end) normalized.applicationStatus = 'open';
    else normalized.applicationStatus = 'upcoming';
  }

  if (!normalized.admitCardStatus) {
    const admit = typeof normalized.admitCardDate === 'string' ? normalized.admitCardDate : null;
    if (admit && admit <= today) normalized.admitCardStatus = 'available';
    else if (admit && admit > today) normalized.admitCardStatus = 'upcoming';
    else normalized.admitCardStatus = 'not-released';
  } else if (normalized.admitCardStatus === 'notreleased') {
    normalized.admitCardStatus = 'not-released';
  }

  if (!normalized.resultStatus) {
    const resultDate = typeof normalized.resultDate === 'string' ? normalized.resultDate : null;
    if (resultDate && resultDate <= today) normalized.resultStatus = 'declared';
    else if (resultDate && resultDate > today) normalized.resultStatus = 'expected';
    else normalized.resultStatus = 'not-declared';
  } else if (normalized.resultStatus === 'notdeclared') {
    normalized.resultStatus = 'not-declared';
  }

  return normalized;
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
