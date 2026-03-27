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

const normalizePlace = (entity: any, origin: string) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  const normalized: any = { id: String(id), ...rest };

  // Flatten address component
  const addr = normalized.address && typeof normalized.address === 'object' ? normalized.address : null;
  if (addr) {
    if (!normalized.city) normalized.city = addr.city ?? '';
    if (!normalized.district) normalized.district = addr.district ?? '';
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

  if (!normalized.nameHindi && normalized.name) normalized.nameHindi = normalized.name;
  if (!normalized.descriptionHindi && normalized.description) normalized.descriptionHindi = normalized.description;

  return normalized;
};

export default factories.createCoreController('api::place.place' as any, ({ strapi }) => ({
  async find(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const entities = await (strapi.entityService as any).findMany('api::place.place', {
      sort: [{ isFeatured: 'desc' }, { name: 'asc' }],
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 500,
    });
    return (entities as any[]).map((e) => normalizePlace(e, origin));
  },

  async findOne(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::place.place', id, {
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
    });
    if (!entity) { ctx.notFound('Place not found'); return; }
    return normalizePlace(entity, origin);
  },

  async findBySlug(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::place.place', {
      filters: { slug },
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Place not found'); return; }
    return normalizePlace(entity, origin);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::place.place', {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizePlace(entity, origin);
  },

  async update(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::place.place', id, {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizePlace(entity, origin);
  },

  async publish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::place.place', id, {
      data: { publishedAt: new Date().toISOString() },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizePlace(entity, origin);
  },

  async unpublish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::place.place', id, {
      data: { publishedAt: null },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizePlace(entity, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::place.place', id);
    ctx.status = 204;
  },
}));
