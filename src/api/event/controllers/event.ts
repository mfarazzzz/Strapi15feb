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

const deriveStatus = (startDate: string, endDate?: string): string => {
  const now = new Date().toISOString();
  if (startDate > now) return 'upcoming';
  if (endDate && endDate < now) return 'completed';
  if (!endDate && startDate < now) return 'completed';
  return 'ongoing';
};

const normalizeEvent = (entity: any, origin: string) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  const normalized: any = { id: String(id), ...rest };

  // Map startDate → date (Frontend type uses `date`)
  if (!normalized.date && normalized.startDate) normalized.date = normalized.startDate;

  // Flatten address component
  const addr = normalized.address && typeof normalized.address === 'object' ? normalized.address : null;
  if (addr) {
    if (!normalized.city) normalized.city = addr.city ?? '';
    if (!normalized.district) normalized.district = addr.district ?? '';
    normalized.address = addr.street ?? addr.streetHindi ?? '';
    normalized.addressHindi = addr.streetHindi ?? addr.street ?? '';
  }

  // Derive status if not set
  if (!normalized.status && normalized.startDate) {
    normalized.status = deriveStatus(normalized.startDate, normalized.endDate);
  }

  // Normalize image
  if (normalized.image?.url) normalized.image = toAbsoluteUrl(origin, normalized.image.url);
  if (Array.isArray(normalized.gallery)) {
    normalized.gallery = normalized.gallery
      .map((g: any) => (g?.url ? toAbsoluteUrl(origin, g.url) : null))
      .filter(Boolean);
  }

  if (!normalized.titleHindi && normalized.title) normalized.titleHindi = normalized.title;
  if (!normalized.descriptionHindi && normalized.description) normalized.descriptionHindi = normalized.description;
  if (!normalized.venueHindi && normalized.venue) normalized.venueHindi = normalized.venue;

  return normalized;
};

export default factories.createCoreController('api::event.event' as any, ({ strapi }) => ({
  async find(ctx) {
    ctx.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    const origin = ctx.request.origin || '';
    const entities = await (strapi.entityService as any).findMany('api::event.event', {
      sort: [{ startDate: 'asc' }],
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 500,
    });
    return (entities as any[]).map((e) => normalizeEvent(e, origin));
  },

  async upcoming(ctx) {
    ctx.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    const origin = ctx.request.origin || '';
    const now = new Date().toISOString();
    const limit = Math.min(Number(ctx.query.limit) || 10, 50);
    const entities = await (strapi.entityService as any).findMany('api::event.event', {
      filters: { startDate: { $gte: now } },
      sort: [{ startDate: 'asc' }],
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit,
    });
    return (entities as any[]).map((e) => normalizeEvent(e, origin));
  },

  async findOne(ctx) {
    ctx.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::event.event', id, {
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
    });
    if (!entity) { ctx.notFound('Event not found'); return; }
    return normalizeEvent(entity, origin);
  },

  async findBySlug(ctx) {
    ctx.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    const origin = ctx.request.origin || '';
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::event.event', {
      filters: { slug },
      populate: { image: true, gallery: true, address: true, seo: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Event not found'); return; }
    return normalizeEvent(entity, origin);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::event.event', {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeEvent(entity, origin);
  },

  async update(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::event.event', id, {
      data: body,
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeEvent(entity, origin);
  },

  async publish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::event.event', id, {
      data: { publishedAt: new Date().toISOString() },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeEvent(entity, origin);
  },

  async unpublish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::event.event', id, {
      data: { publishedAt: null },
      populate: { image: true, gallery: true, address: true, seo: true },
    });
    return normalizeEvent(entity, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::event.event', id);
    ctx.status = 204;
  },
}));
