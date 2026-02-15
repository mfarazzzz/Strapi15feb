import { factories } from '@strapi/strapi';

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
};

const normalizeItem = (entity: any) => {
  if (!entity) return null;
  const { id, payload } = entity;
  const body = payload && typeof payload === 'object' ? payload : {};
  return { id: String(id), ...body };
};

const moduleTypeValues = [
  'exam',
  'result',
  'institution',
  'holiday',
  'restaurant',
  'fashion-store',
  'shopping-centre',
  'famous-place',
  'event',
] as const;

type ModuleType = (typeof moduleTypeValues)[number];

const moduleTypes = new Set<ModuleType>(moduleTypeValues);

const isModuleType = (value: unknown): value is ModuleType =>
  typeof value === 'string' && moduleTypes.has(value as ModuleType);

const pickIndexFields = (moduleType: ModuleType, value: any) => {
  const slug = value?.slug;
  const title = value?.title ?? value?.name ?? undefined;
  const titleHindi = value?.titleHindi ?? value?.nameHindi ?? undefined;
  const name = value?.name ?? undefined;
  const nameHindi = value?.nameHindi ?? undefined;
  const subtype = typeof value?.type === 'string' && !moduleTypes.has(value.type as any) ? value.type : undefined;
  const category = value?.category ?? subtype ?? undefined;
  const subcategory = value?.subcategory ?? (value?.category && subtype ? subtype : undefined);
  const status = value?.status ?? undefined;
  const city = value?.city ?? undefined;
  const district = value?.district ?? undefined;
  const featured = value?.isFeatured ?? value?.featured ?? undefined;
  const popular = value?.isPopular ?? value?.popular ?? undefined;
  const image = value?.image ?? undefined;
  const order = value?.order ?? undefined;

  const date = value?.examDate ?? value?.resultDate ?? value?.date ?? value?.publishedAt ?? undefined;
  const endDate = value?.endDate ?? undefined;

  return {
    type: moduleType,
    slug,
    title,
    titleHindi,
    name,
    nameHindi,
    category,
    subcategory,
    status,
    city,
    district,
    date,
    endDate,
    featured,
    popular,
    image,
    order,
  };
};

export default factories.createCoreController('api::microsite-item.microsite-item', ({ strapi }) => ({
  async recentResults(ctx) {
    const limit = parseNumber(ctx.query.limit) ?? 25;
    const entities = await strapi.entityService.findMany('api::microsite-item.microsite-item', {
      filters: { type: 'result' },
      sort: { date: 'desc' },
      start: 0,
      limit: Math.min(Math.max(limit, 1), 100),
    });
    return (entities as any[]).map(normalizeItem).filter(Boolean);
  },

  async find(ctx) {
    const limit = parseNumber(ctx.query.limit) ?? 25;
    const offset = parseNumber(ctx.query.offset) ?? 0;

    const typeCandidate = parseString(ctx.query.moduleType) ?? parseString(ctx.query.type);
    const type = isModuleType(typeCandidate) ? typeCandidate : undefined;
    const category = parseString(ctx.query.category);
    const subcategory = parseString(ctx.query.subcategory);
    const status = parseString(ctx.query.status);
    const city = parseString(ctx.query.city);
    const district = parseString(ctx.query.district);
    const featured = parseBoolean(ctx.query.featured);
    const popular = parseBoolean(ctx.query.popular);
    const search = parseString(ctx.query.search);
    const orderBy = parseString(ctx.query.orderBy) ?? 'date';
    const order = (parseString(ctx.query.order) ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const filters: Record<string, any> = {};
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (subcategory) filters.subcategory = subcategory;
    if (status) filters.status = status;
    if (city) filters.city = city;
    if (district) filters.district = district;
    if (featured !== undefined) filters.featured = featured;
    if (popular !== undefined) filters.popular = popular;
    if (search) {
      filters.$or = [
        { title: { $containsi: search } },
        { titleHindi: { $containsi: search } },
        { name: { $containsi: search } },
        { nameHindi: { $containsi: search } },
        { slug: { $containsi: search } },
      ];
    }

    const sortKeyWhitelist = new Set(['date', 'order', 'createdAt', 'updatedAt', 'title', 'name']);
    const sortField = sortKeyWhitelist.has(orderBy) ? orderBy : 'date';
    const sort = { [sortField]: order };

    const [entities, total] = await Promise.all([
      strapi.entityService.findMany('api::microsite-item.microsite-item', {
        filters,
        sort,
        start: offset,
        limit,
      }),
      strapi.entityService.count('api::microsite-item.microsite-item', { filters }),
    ]);

    const pageSize = limit;
    const page = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      data: (entities as any[]).map(normalizeItem).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async findOne(ctx) {
    const id = ctx.params.id;
    const entity = await strapi.entityService.findOne('api::microsite-item.microsite-item', id);
    if (!entity) {
      ctx.notFound('Item not found');
      return;
    }
    return normalizeItem(entity);
  },

  async findBySlug(ctx) {
    const slug = ctx.params.slug;
    const typeCandidate = parseString(ctx.query.moduleType) ?? parseString(ctx.query.type);
    const type = isModuleType(typeCandidate) ? typeCandidate : undefined;
    const filters: Record<string, any> = { slug };
    if (type) filters.type = type;

    const entities = await strapi.entityService.findMany('api::microsite-item.microsite-item', {
      filters,
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) {
      ctx.notFound('Item not found');
      return;
    }
    return normalizeItem(entity);
  },

  async create(ctx) {
    const body = ctx.request.body ?? {};
    const value = body?.data && typeof body.data === 'object' ? body.data : body;

    const moduleTypeCandidate = (() => {
      const candidate = parseString(value?.moduleType) ?? (typeof value?.type === 'string' ? value.type : undefined);
      return isModuleType(candidate) ? candidate : undefined;
    })();

    if (!moduleTypeCandidate || !value?.slug) {
      ctx.badRequest('moduleType and slug are required');
      return;
    }

    const { moduleType: _mt, ...rest } = value || {};
    const payload =
      typeof rest?.type === 'string' && isModuleType(rest.type)
        ? Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'type'))
        : rest;

    const index = pickIndexFields(moduleTypeCandidate, payload);
    const entity = await strapi.entityService.create('api::microsite-item.microsite-item', {
      data: {
        ...index,
        payload,
      },
    });
    return normalizeItem(entity);
  },

  async update(ctx) {
    const id = ctx.params.id;
    const body = ctx.request.body ?? {};
    const value = body?.data && typeof body.data === 'object' ? body.data : body;

    const existing = await strapi.entityService.findOne('api::microsite-item.microsite-item', id);
    if (!existing) {
      ctx.notFound('Item not found');
      return;
    }

    const moduleType = isModuleType(existing?.type) ? (existing.type as ModuleType) : undefined;
    if (!moduleType) {
      ctx.badRequest('Invalid module type');
      return;
    }
    const incoming = (() => {
      const { moduleType: _mt, ...rest } = value || {};
      if (typeof rest?.type === 'string' && isModuleType(rest.type)) {
        return Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'type'));
      }
      return rest;
    })();

    const nextPayload =
      existing?.payload && typeof existing.payload === 'object'
        ? { ...existing.payload, ...incoming }
        : { ...incoming };

    const index = pickIndexFields(moduleType, nextPayload);

    const entity = await strapi.entityService.update('api::microsite-item.microsite-item', id, {
      data: {
        ...index,
        payload: nextPayload,
      },
    });
    return normalizeItem(entity);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete('api::microsite-item.microsite-item', id);
    ctx.status = 204;
  },
}));
