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

const normalizeRestaurant = (entity: any, origin: string) => {
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
    // Keep address as a flat string for display
    normalized.address = addr.street ?? addr.streetHindi ?? '';
    normalized.addressHindi = addr.streetHindi ?? addr.street ?? '';
  }

  // Flatten contact component
  const contact = normalized.contact && typeof normalized.contact === 'object' ? normalized.contact : null;
  if (contact) {
    if (!normalized.phone) normalized.phone = contact.phone ?? contact.alternatePhone ?? '';
    if (!normalized.email) normalized.email = contact.email ?? '';
    if (!normalized.website) normalized.website = contact.website ?? '';
    if (!normalized.whatsapp) normalized.whatsapp = contact.whatsapp ?? '';
  }

  // Normalize image URL
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

export default factories.createCoreController('api::restaurant.restaurant' as any, ({ strapi }) => ({
  async find(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const entities = await (strapi.entityService as any).findMany('api::restaurant.restaurant', {
      sort: [{ isFeatured: 'desc' }, { name: 'asc' }],
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
      publicationState: 'live',
      limit: 500,
    });
    return (entities as any[]).map((e) => normalizeRestaurant(e, origin));
  },

  async findOne(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const entity = await (strapi.entityService as any).findOne('api::restaurant.restaurant', id, {
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
      publicationState: 'live',
    });
    if (!entity) { ctx.notFound('Restaurant not found'); return; }
    return normalizeRestaurant(entity, origin);
  },

  async findBySlug(ctx) {
    ctx.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    const origin = ctx.request.origin || '';
    const slug = ctx.params.slug;
    const entities = await (strapi.entityService as any).findMany('api::restaurant.restaurant', {
      filters: { slug },
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
      publicationState: 'live',
      limit: 1,
    });
    const entity = (entities as any[])[0];
    if (!entity) { ctx.notFound('Restaurant not found'); return; }
    return normalizeRestaurant(entity, origin);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).create('api::restaurant.restaurant', {
      data: body,
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
    });
    return normalizeRestaurant(entity, origin);
  },

  async update(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const body = extractData(ctx.request.body);
    const entity = await (strapi.entityService as any).update('api::restaurant.restaurant', id, {
      data: body,
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
    });
    return normalizeRestaurant(entity, origin);
  },

  async publish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::restaurant.restaurant', id, {
      data: { publishedAt: new Date().toISOString() },
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
    });
    return normalizeRestaurant(entity, origin);
  },

  async unpublish(ctx) {
    const id = ctx.params.id;
    const origin = ctx.request.origin || '';
    const entity = await (strapi.entityService as any).update('api::restaurant.restaurant', id, {
      data: { publishedAt: null },
      populate: { image: true, gallery: true, address: true, contact: true, seo: true },
    });
    return normalizeRestaurant(entity, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await (strapi.entityService as any).delete('api::restaurant.restaurant', id);
    ctx.status = 204;
  },
}));
