const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';

const CACHE_KEY = 'sitemap:xml:v1';
const CACHE_TTL_SECONDS = 600;

let memoryCache: { xml: string; expiresAt: number } | null = null;
let redisClient: any = null;
let redisInit: Promise<void> | null = null;

const getRedis = async () => {
  const enabled = String(process.env.REDIS_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
  const url = String(process.env.REDIS_URL ?? '').trim();
  if (!enabled || !url) return null;

  if (redisClient) return redisClient;
  if (redisInit) {
    await redisInit;
    return redisClient;
  }

  const { createClient } = await import('redis');
  const client = createClient({ url });
  redisInit = client.connect().then(() => {
    redisClient = client;
  });
  await redisInit;
  return redisClient;
};

const escapeXml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatIso = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
};

const normalizeOrigin = (ctx: any) => {
  const fromEnv = typeof process.env.STRAPI_PUBLIC_URL === 'string' ? process.env.STRAPI_PUBLIC_URL.trim() : '';
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const headerHost = typeof ctx?.request?.header?.host === 'string' ? String(ctx.request.header.host) : '';
  const forwardedProto =
    typeof ctx?.request?.header?.['x-forwarded-proto'] === 'string'
      ? String(ctx.request.header['x-forwarded-proto']).split(',')[0].trim()
      : '';
  const forwardedHost =
    typeof ctx?.request?.header?.['x-forwarded-host'] === 'string'
      ? String(ctx.request.header['x-forwarded-host']).split(',')[0].trim()
      : '';
  const proto = forwardedProto || 'http';
  const host = forwardedHost || headerHost;
  if (host) {
    const hostValue = String(host).trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(hostValue)) return hostValue.replace(/\/+$/, '');
    return `${proto}://${hostValue}`.replace(/\/+$/, '');
  }
  return SITE_URL;
};

const fetchAll = async (strapi: any, uid: string, query: any) => {
  const pageSize = 5000;
  let start = 0;
  const all: any[] = [];
  while (start < 50000) {
    const batch = await strapi.entityService.findMany(uid, { ...query, start, limit: pageSize });
    const list = Array.isArray(batch) ? batch : [];
    all.push(...list);
    if (list.length < pageSize) break;
    start += pageSize;
  }
  return all;
};

const buildUrlEntry = (loc: string, lastmod: string, changefreq: string, priority: string) => {
  const safeLoc = escapeXml(loc);
  const safeLastmod = escapeXml(lastmod);
  return `
  <url>
    <loc>${safeLoc}</loc>
    <lastmod>${safeLastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

export default {
  async sitemapXml(ctx: any) {
    const now = Date.now();

    try {
      const redis = await getRedis();
      if (redis) {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          ctx.type = 'application/xml';
          ctx.set('X-Sitemap-Cache', 'HIT');
          return cached;
        }
      } else if (memoryCache && memoryCache.expiresAt > now) {
        ctx.type = 'application/xml';
        ctx.set('X-Sitemap-Cache', 'HIT');
        return memoryCache.xml;
      }
    } catch {
      void 0;
    }

    const origin = normalizeOrigin(ctx);
    const nowIso = new Date().toISOString();

    const [articles, categories, tags] = await Promise.all([
      fetchAll(strapi, 'api::article.article', {
        filters: {},
        // Using deterministic sorting: publishedAt desc, id desc
        sort: [{ publishedAt: 'desc' }, { id: 'desc' }] as any,
        fields: ['slug', 'updatedAt', 'publishedAt', 'createdAt', 'canonicalUrl'],
        populate: { category: { fields: ['slug'] } },
        publicationState: 'live',
      }),
      fetchAll(strapi, 'api::category.category', { fields: ['slug', 'path', 'updatedAt'], sort: [{ order: 'asc' }] }),
      fetchAll(strapi, 'api::tag.tag', { fields: ['slug', 'updatedAt'], sort: [{ name: 'asc' }] }),
    ]);

    const urls: string[] = [];

    urls.push(buildUrlEntry(`${origin}/`, nowIso, 'hourly', '1.0'));

    for (const c of categories as any[]) {
      const p = (c?.path || c?.slug || '').toString().trim().replace(/^\/+/, '');
      if (!p) continue;
      const loc = `${origin}/${p}`.replace(/\/+/g, '/').replace(':/', '://');
      const lastmod = formatIso(c?.updatedAt) || nowIso;
      urls.push(buildUrlEntry(loc, lastmod, 'daily', '0.8'));
    }

    for (const t of tags as any[]) {
      const slug = (t?.slug || '').toString().trim();
      if (!slug) continue;
      const loc = `${origin}/tags/${slug}`.replace(/\/+/g, '/').replace(':/', '://');
      const lastmod = formatIso(t?.updatedAt) || nowIso;
      urls.push(buildUrlEntry(loc, lastmod, 'weekly', '0.4'));
    }

    for (const a of articles as any[]) {
      const slug = (a?.slug || '').toString().trim();
      const categorySlug = (a?.category?.slug || '').toString().trim();
      if (!slug || !categorySlug) continue;
      const canonicalRaw = a?.canonicalUrl ? String(a.canonicalUrl).trim() : '';
      const canonical =
        canonicalRaw && /^https?:\/\//i.test(canonicalRaw)
          ? canonicalRaw
          : canonicalRaw
            ? `${origin}/${canonicalRaw.replace(/^\/+/, '')}`
            : '';
      const loc = (canonical || `${origin}/${categorySlug}/${slug}`).replace(/\/+/g, '/').replace(':/', '://');
      const lastmod = formatIso(a?.updatedAt || a?.publishedAt || a?.createdAt) || nowIso;
      urls.push(buildUrlEntry(loc, lastmod, 'hourly', '0.9'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

    try {
      const redis = await getRedis();
      if (redis) {
        await redis.set(CACHE_KEY, xml, { EX: CACHE_TTL_SECONDS });
      } else {
        memoryCache = { xml, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
      }
    } catch {
      void 0;
    }

    ctx.type = 'application/xml';
    ctx.set('X-Sitemap-Cache', 'MISS');
    return xml;
  },
};

