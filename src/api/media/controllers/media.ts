const toAbsoluteUrl = (origin: string, url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
};

const normalizeMedia = (file: any, origin: string) => {
  if (!file) return null;
  return {
    id: String(file.id),
    url: toAbsoluteUrl(origin, file.url),
    title: file.name || file.hash || 'file',
    altText: file.alternativeText || file.caption || file.name || '',
    mimeType: file.mime,
    size: file.size,
    width: file.width,
    height: file.height,
    uploadedAt: file.createdAt,
    uploadedBy: 'strapi',
  };
};

const getFileFromRequest = (ctx: any) => {
  const files = ctx.request.files || {};
  const candidate = files.file || files.files;
  if (!candidate) return null;
  if (Array.isArray(candidate)) return candidate[0];
  return candidate;
};

export default {
  async find(ctx) {
    const limitParam = Number(ctx.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const origin = ctx.request.origin || '';

    const entities = await strapi.entityService.findMany('plugin::upload.file', {
      sort: { createdAt: 'desc' },
      limit,
    });

    return (entities as any[]).map((f) => normalizeMedia(f, origin)).filter(Boolean);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const file = getFileFromRequest(ctx);

    if (!file) {
      ctx.badRequest('Missing file');
      return;
    }

    const uploaded = await strapi.plugin('upload').service('upload').upload({
      data: {},
      files: file,
    });

    const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    return normalizeMedia(first, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    const file = await strapi.entityService.findOne('plugin::upload.file', id);
    if (!file) {
      ctx.notFound('Media not found');
      return;
    }

    await strapi.plugin('upload').service('upload').remove(file);
    ctx.status = 204;
  },
};
