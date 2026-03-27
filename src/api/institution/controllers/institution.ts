import { factories } from '@strapi/strapi';

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const toAbsoluteUrl = (origin: string, url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try { return new URL(url, origin).toString(); } catch { return url; }
};

const normalizeInstitution = (entity: any, origin: string) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  const normalized: any = { id: String(id), ...rest };

  // Flatten address component → flat fields expected by Frontend
  const addr = normalized.address && typeof normalized.address === 'object' ? normalized.address : null;
  if (addr) {
    if (!normalized.city) normalized.city = addr.city ?? '';
    if (!normalized.district) normalized.district = addr.district ?? '';
    if (!normalized.state) normalized.state = addr.state ?? '';
    if (!normalized.pincode) normalized.pincode = addr.pincode ?? '';
    normalized.address = addr.street ?? addr.streetHindi ?? '';
    normalized.addressHindi = addr.streetHindi ?? addr.street ?? '';
  }

  // Normalize image URLs
  if (normalized.image?.url) normalized.image = toAbsoluteUrl(origin, normalized.image.url);
  if (Array.isArray(normalized.gallery)) {
    normalized.gallery = normalized.gallery
      .map((g: any) => (g?.url ? toAbsoluteUrl(origin, g.url) : null))
      .filter(Boolean);
  }

  // reviews alias
  if (normalized.reviewCount !== undefined && normalized.reviews === undefined) {
    normalized.reviews = normalized.reviewCount;
  }

  if (!normalized.nameHindi && normalized.name) normalized.nameHindi = normalized.name;
  if (!normalized.descriptionHindi && normalized.description) normalized.descriptionHindi = normalized.description;

  return normalized;
};

export default factories.createCoreController('api::institution.institution' as any, ({ strapi }) => ({
  async find(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const entities = await (strapi.entityService as any).findMany('api::institution.institution', {
      sort: [{ isFeatured: 'desc' }, { name: 'asc' }],
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 500,
    });
    return (entities as any[]).map((e) => normalizeInstitution(e, origin));
  },

  async findOne(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::institution.institution', id, {
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
    });
    if (!entity) { ctx.notFound('Institution not found'); return; }
    return normalizeInstitution(entity, origin);
  },

  async findBySlug(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::institution.institution', {
      filters: { slug },
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Institution not found'); return; }
    return normalizeInstitution(entity, origin);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::institution.institution', {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeInstitution(entity, origin);
  },

  async update(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::institution.institution', id, {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeInstitution(entity, origin);
  },

  async publish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::institution.institution', id, {
      data: { publishedAt: new Date().toISOString() },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeInstitution(entity, origin);
  },

  async unpublish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::institution.institution', id, {
      data: { publishedAt: null },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeInstitution(entity, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::institution.institution', id);
    ctx.status = 204;
  },
}));
