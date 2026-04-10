import { factories } from '@strapi/strapi';
import trendingService from '../services/trending';
import { invalidateArticleCache } from '../../../middlewares/redis-cache';
import { batchRecalcAllTagCounts } from '../../tag/controllers/tag';

// Redis cache config — mirrors the config registered in config/middlewares.ts
const redisCacheConfig = {
  enabled: Boolean(process.env.REDIS_URL) && process.env.REDIS_CACHE_ENABLED !== 'false',
  url: process.env.REDIS_URL || '',
  ttlSeconds: Number.isFinite(Number(process.env.REDIS_CACHE_TTL)) ? Number(process.env.REDIS_CACHE_TTL) : 60,
  keyPrefix: process.env.REDIS_CACHE_PREFIX || 'strapi-cache',
};

const MAX_LIMIT = 5000;
const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';
const EDITORIAL_CATEGORY_SLUG = 'editorials';
const EDITORIAL_CONTENT_TYPES = ['editorial', 'review', 'interview', 'opinion', 'special-report'] as const;
const DEFAULT_SORT_FIELD = 'publishedAt';

/**
 * triggerFrontendRevalidation — SINGLE SOURCE OF CACHE INVALIDATION
 *
 * Called ONLY from the publish handler. Never from lifecycle hooks.
 * This prevents duplicate revalidation calls on rapid saves / race conditions.
 *
 * Resolves all paths that need invalidation:
 *   /:category/:slug  — the article page
 *   /                 — homepage (breaking/featured may have changed)
 *   /:category        — category listing page
 *
 * Fail-safe: errors are logged but never block the publish response.
 */
const triggerFrontendRevalidation = async (strapi: any, entity: any): Promise<void> => {
  const slug = typeof entity?.slug === 'string' ? entity.slug.trim() : '';
  const categorySlug = typeof entity?.category?.slug === 'string'
    ? entity.category.slug.trim().toLowerCase()
    : '';
  const documentId = entity?.documentId || entity?.id || 'unknown';

  // Build the set of paths to invalidate
  const paths = new Set<string>(['/']);
  if (categorySlug && slug) {
    paths.add(`/${categorySlug}/${slug}`);
    paths.add(`/${categorySlug}`);
  } else if (slug) {
    // Category missing — invalidate slug-only fallback
    paths.add(`/${slug}`);
  }

  const revalidateSecret = String(process.env.REVALIDATE_SECRET ?? '').trim();
  const revalidateBase = String(process.env.SITE_URL ?? SITE_URL).trim().replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (revalidateSecret) headers['x-revalidate-token'] = revalidateSecret;

  const pathList = Array.from(paths);

  strapi.log.info(JSON.stringify({
    event: 'REVALIDATION_TRIGGERED',
    documentId,
    slug,
    categorySlug,
    paths: pathList,
    timestamp: new Date().toISOString(),
  }));

  try {
    const res = await fetch(`${revalidateBase}/api/revalidate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ slug, type: 'article', category: categorySlug, paths: pathList }),
    });
    if (!res.ok) {
      strapi.log.warn(JSON.stringify({
        event: 'REVALIDATION_FAILED',
        documentId,
        status: res.status,
        paths: pathList,
      }));
    } else {
      strapi.log.info(JSON.stringify({
        event: 'REVALIDATION_SUCCESS',
        documentId,
        paths: pathList,
        timestamp: new Date().toISOString(),
      }));
    }
  } catch (err) {
    // Non-fatal — publish already succeeded. Log and move on.
    strapi.log.warn(JSON.stringify({
      event: 'REVALIDATION_ERROR',
      documentId,
      error: err instanceof Error ? err.message : String(err),
      paths: pathList,
    }));
  }
};

const LIST_FIELDS = [
  'title', 'short_headline', 'slug', 'excerpt', 'publishedAt', 'createdAt', 'updatedAt',
  'readTime', 'isFeatured', 'isBreaking', 'isEditorsPick', 'contentType', 'views', 'shares',
  'focus_keyword', 'location', 'news_category', 'seoTitle', 'ogTitle', 'ogDescription', 'discoverEligible',
  'canonicalUrl', 'newsKeywords', 'meta_description', 'videoUrl', 'videoType', 'videoTitle',
  'workflowStatus', 'workflowNote',
  'seoShortTailKeywords', 'seoLongTailKeywords', 'seoKeywordsJson',
];

const resolveSortField = (orderBy: string | undefined) => {
  const sortKeyWhitelist = new Set(['publishedAt', 'createdAt', 'views', 'title', 'id']);
  const sortFieldRaw = orderBy && sortKeyWhitelist.has(orderBy) ? orderBy : DEFAULT_SORT_FIELD;
  if (sortFieldRaw === 'publishedDate') return 'publishedAt';
  return sortFieldRaw;
};

const toAbsoluteUrl = (origin: string, url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
};
const getPublisherLogoUrl = (origin?: string) => {
  const base = String(origin || SITE_URL || 'https://rampurnews.com').trim().replace(/\/+$/, '');
  if (!base) return 'https://rampurnews.com/logo.png';
  if (base.startsWith('http://')) return `${base.replace(/^http:\/\//, 'https://')}/logo.png`;
  if (!base.startsWith('https://')) return 'https://rampurnews.com/logo.png';
  return `${base}/logo.png`;
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');

const normalizeSlugValue = (value: string) => {
  const base = slugify(value);
  if (!base) return '';
  if (base.length <= 70) return base;
  return base.slice(0, 70).replace(/-+$/g, '');
};

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

const parseLimit = (value: unknown, fallback: number) => {
  const limit = parseNumber(value) ?? fallback;
  if (limit <= 0) return fallback;
  return Math.min(limit, MAX_LIMIT);
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v ? v : undefined;
};

const isISODate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return Number.isFinite(d.getTime());
};

const parseDateToISO = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (isISODate(value)) return new Date(value).toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return undefined;
};

const normalizeArticle = (entity: any, origin: string, options: { excludeContent?: boolean } = {}) => {
  if (!entity) return null;
  const featuredImageUrl =
    entity?.featured_image?.url || entity?.image?.url
      ? toAbsoluteUrl(origin, entity?.featured_image?.url || entity?.image?.url)
      : '';

  // Use publishedAt as the single source of truth for published/draft state.
  //
  // Why NOT entity.status:
  //   - entityService (used by find, featured, breaking, byCategory, etc.) returns
  //     entity.status = 'draft' even for published articles when fetched with
  //     publicationState: 'live'. The `status` field reflects the document's draft
  //     version state, not whether the live version exists.
  //   - Document Service findMany with status: 'published' also returns entities
  //     where entity.status may be 'draft' depending on Strapi version/config.
  //
  // publishedAt is always null for drafts and always set for published articles,
  // making it the only reliable signal across both entityService and Document Service.
  const publishedAt = entity?.publishedAt || '';
  const status: 'draft' | 'published' = publishedAt ? 'published' : 'draft';

  const tags = Array.isArray(entity?.tags)
    ? (entity.tags as any[])
        .map((t) => (t?.name ? String(t.name) : ''))
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const categories =
    Array.isArray(entity?.categories) && entity.categories.length > 0
      ? (entity.categories as any[])
          .map((c) => (c?.slug ? String(c.slug) : ''))
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

  const authorId =
    entity?.author && entity.author.id !== undefined && entity.author.id !== null
      ? String(entity.author.id)
      : undefined;
  const authorSlug =
    entity?.author && entity.author.slug ? String(entity.author.slug) : undefined;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: entity?.short_headline ? String(entity.short_headline) : entity?.title ? String(entity.title) : '',
    image: featuredImageUrl || '',
    datePublished: publishedAt || (entity?.createdAt ? String(entity.createdAt) : ''),
    dateModified: entity?.updatedAt ? String(entity.updatedAt) : publishedAt || '',
    author: {
      '@type': 'Person',
      name:
        entity?.author?.nameHindi
          ? String(entity.author.nameHindi)
          : entity?.author?.name
            ? String(entity.author.name)
            : '',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Rampur News',
      logo: {
        '@type': 'ImageObject',
        url: getPublisherLogoUrl(origin),
        width: 768,
        height: 768,
      },
    },
  };

  return {
    id: String(entity.id),
    title: entity?.title ? String(entity.title) : '',
    short_headline: entity?.short_headline ? String(entity.short_headline) : '',
    slug: entity?.slug ? String(entity.slug) : '',
    excerpt: entity?.excerpt ? String(entity.excerpt) : '',
    content: options.excludeContent ? '' : (entity?.content ? String(entity.content) : ''),
    image: featuredImageUrl || '/placeholder.svg',
    featured_image: featuredImageUrl || undefined,
    featured_image_id: entity?.featured_image?.id ? String(entity.featured_image.id) : undefined,
    category: entity?.category?.slug ? String(entity.category.slug) : '',
    categoryHindi: entity?.category?.titleHindi ? String(entity.category.titleHindi) : '',
    author: entity?.author?.name ? String(entity.author.name) : entity?.author?.nameHindi ? String(entity.author.nameHindi) : '',
    authorId,
    authorSlug,
    publishedDate: publishedAt || (entity?.createdAt ? String(entity.createdAt) : new Date().toISOString()),
    publishedAt: publishedAt || undefined,
    modifiedDate: entity?.updatedAt ? String(entity.updatedAt) : undefined,
    updatedAt: entity?.updatedAt ? String(entity.updatedAt) : undefined,
    readTime: entity?.readTime ? String(entity.readTime) : undefined,
    isFeatured: Boolean(entity?.isFeatured),
    isBreaking: Boolean(entity?.isBreaking),
    isEditorsPick: Boolean((entity as any)?.isEditorsPick),
    contentType: (entity as any)?.contentType ? String((entity as any).contentType) : 'news',
    authorRole:
      entity?.author && typeof (entity.author as any)?.role === 'string'
        ? String((entity.author as any).role)
        : undefined,
    views: typeof entity?.views === 'number' ? entity.views : undefined,
    shares: typeof (entity as any)?.shares === 'number' ? (entity as any).shares : undefined,
    status,
    tags: tags.length > 0 ? tags : undefined,
    categories: categories.length > 0 ? categories : undefined,
    focus_keyword: entity?.focus_keyword ? String(entity.focus_keyword) : undefined,
    location: entity?.location ? String(entity.location) : undefined,
    news_category: entity?.news_category ? String(entity.news_category) : undefined,
    metaTitle: entity?.seoTitle ? String(entity.seoTitle) : entity?.title ? String(entity.title) : undefined,
    metaDescription: entity?.meta_description ? String(entity.meta_description) : undefined,
    ogImage: featuredImageUrl || undefined,
    seoTitle: entity?.seoTitle ? String(entity.seoTitle) : undefined,
    ogTitle: entity?.ogTitle ? String(entity.ogTitle) : undefined,
    ogDescription: entity?.ogDescription ? String(entity.ogDescription) : undefined,
    discoverEligible: typeof entity?.discoverEligible === 'boolean' ? entity.discoverEligible : undefined,
    canonicalUrl: entity?.canonicalUrl ? String(entity.canonicalUrl) : undefined,
    newsKeywords: entity?.newsKeywords ? String(entity.newsKeywords) : undefined,
    schemaJson: entity?.schemaJson ?? undefined,
    meta_description: entity?.meta_description ? String(entity.meta_description) : undefined,
    videoUrl: entity?.videoUrl ? String(entity.videoUrl) : undefined,
    videoType: entity?.videoType ? String(entity.videoType) : undefined,
    videoTitle: entity?.videoTitle ? String(entity.videoTitle) : undefined,
    jsonLd: structuredData,
    structuredData,
    // Workflow — if the article is published (live), always report 'approved'
    // regardless of the workflowStatus field value. The workflowStatus field
    // tracks editorial workflow state and defaults to 'draft' in the schema,
    // but it is NOT updated by the Document Service publish action. A published
    // article is by definition approved, so we derive this from the status.
    workflowStatus: status === 'published'
      ? 'approved'
      : (entity?.workflowStatus ? String(entity.workflowStatus) : 'draft'),
    workflowNote: entity?.workflowNote ? String(entity.workflowNote) : undefined,
    // SEO keyword arrays (stored as JSON in Strapi)
    seoShortTailKeywords: Array.isArray(entity?.seoShortTailKeywords) ? entity.seoShortTailKeywords : undefined,
    seoLongTailKeywords: Array.isArray(entity?.seoLongTailKeywords) ? entity.seoLongTailKeywords : undefined,
    seoKeywordsJson: entity?.seoKeywordsJson ?? undefined,
  };
};

const stripHtmlToText = (value: string) => {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const truncateText = (value: string, maxLength: number) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
};

const buildSeoTitle = (title: string, categoryName: string) => {
  const rawTitle = String(title || '').trim();
  const baseTitle = rawTitle || 'रामपुर न्यूज़';
  const category = String(categoryName || '').trim();
  const brand = 'Rampur News';
  const hasBrand =
    baseTitle.toLowerCase().includes(brand.toLowerCase()) || baseTitle.includes('रामपुर न्यूज़');

  const core = category ? `${baseTitle} | ${category}` : baseTitle;
  const withBrand = hasBrand ? core : `${core} | ${brand}`;
  if (withBrand.length <= 70) return withBrand;

  const compactCore = category ? `${baseTitle} | ${category}` : baseTitle;
  if (compactCore.length <= 70) return truncateText(compactCore, 70);

  const baseWithBrand = hasBrand ? baseTitle : `${baseTitle} | ${brand}`;
  if (baseWithBrand.length <= 70) return baseWithBrand;
  return truncateText(baseWithBrand, 70);
};

const buildSeoDescription = (excerpt: string, content: string) => {
  const fromExcerpt = String(excerpt || '').trim();
  if (fromExcerpt) return truncateText(fromExcerpt, 160);
  const cleaned = stripHtmlToText(content || '');
  if (!cleaned) return 'रामपुर न्यूज़ पर ताज़ा और विश्वसनीय खबरें पढ़ें।';
  return truncateText(cleaned, 160);
};

const buildCanonicalUrl = (categorySlug: string, articleSlug: string) => {
  const c = String(categorySlug || '').trim().replace(/^\/+|\/+$/g, '');
  const s = String(articleSlug || '').trim().replace(/^\/+|\/+$/g, '');
  if (!c || !s) return '';
  return `${SITE_URL}/${c}/${s}`;
};

const buildNewsKeywords = (categoryName: string, tags: string[] | undefined) => {
  const base = [
    String(categoryName || '').trim(),
    'रामपुर',
    'Rampur',
    'Rampur News',
    'रामपुर न्यूज़',
    'उत्तर प्रदेश',
    'Uttar Pradesh',
    'India News',
    'Hindi News',
  ].filter(Boolean);
  const tagList = Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
  const seen = new Set<string>();
  const combined = [...tagList, ...base].filter((k) => {
    const key = k.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return combined.slice(0, 12).join(', ');
};

const buildNewsArticleSchema = (input: {
  canonicalUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string;
  section: string;
  keywords: string;
}) => {
  const canonicalUrl = input.canonicalUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    headline: input.title,
    name: input.title,
    description: input.description,
    image: input.imageUrl
      ? {
          '@type': 'ImageObject',
          url: input.imageUrl,
          width: 1200,
          height: 630,
        }
      : undefined,
    thumbnailUrl: input.imageUrl || undefined,
    datePublished: input.publishedAt || undefined,
    dateModified: input.modifiedAt || input.publishedAt || undefined,
    author: input.authorName ? [{ '@type': 'Person', name: input.authorName }] : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'रामपुर न्यूज़ | Rampur News',
      logo: {
        '@type': 'ImageObject',
        url: getPublisherLogoUrl(SITE_URL),
        width: 768,
        height: 768,
      },
    },
    articleSection: input.section || undefined,
    inLanguage: 'hi-IN',
    isAccessibleForFree: true,
    keywords: input.keywords || undefined,
  };
};

const articlePopulate: any = {
  featured_image: true,
  category: true,
  categories: true,
  author: { populate: { avatar: true } },
  tags: true,
};

export default factories.createCoreController('api::article.article', ({ strapi }) => {
  const es = strapi.entityService as any;

  const getPublicOrigin = (ctx: any): string => {
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
    const forwardedHostWithPort = forwardedHost || headerHost;
    if (forwardedHostWithPort) {
      const hostValue = String(forwardedHostWithPort).trim().replace(/\/+$/, '');
      if (hostValue) {
        if (/^https?:\/\//i.test(hostValue)) return hostValue.replace(/\/+$/, '');
        return `${proto}://${hostValue}`.replace(/\/+$/, '');
      }
    }

    const configuredHost = (strapi.config.get('server.host') as string | undefined) || '127.0.0.1';
    const configuredPort = (strapi.config.get('server.port') as number | undefined) || 1337;
    const host = configuredHost === '0.0.0.0' ? '127.0.0.1' : configuredHost;
    return `${proto}://${host}:${configuredPort}`;
  };

  const extractData = (body: any) => {
    if (body?.data && typeof body.data === 'object') return body.data;
    return body ?? {};
  };

  const ensureUniqueSlug = async (base: string, excludeId?: number): Promise<string> => {
    const fallback = normalizeSlugValue(`article-${Date.now()}`) || `article-${Date.now()}`;
    const root = normalizeSlugValue(base) || fallback;
    let candidate = root;
    let attempt = 1;

    while (attempt < 50) {
      const found = await es.findMany('api::article.article', {
        filters: { slug: candidate },
        limit: 1,
        publicationState: 'preview',
      });

      const existing = Array.isArray(found) ? found[0] : null;
      if (!existing?.id) return candidate;
      if (excludeId && Number(existing.id) === excludeId) return candidate;

      attempt += 1;
      const suffix = String(attempt);
      const maxBase = 70 - suffix.length - 1;
      const trimmedRoot = root.length > maxBase ? root.slice(0, maxBase).replace(/-+$/g, '') : root;
      candidate = `${trimmedRoot}-${suffix}`;
    }

    return normalizeSlugValue(`${root}-${Date.now()}`) || `${root}-${Date.now()}`;
  };

  const parseRelationId = (value: unknown): number | undefined => {
    const raw = typeof value === 'string' ? value.trim() : value;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const resolveCategoryId = async (value: unknown): Promise<number | undefined> => {
    const direct = parseRelationId(value);
    if (direct) return direct;
    const slug = parseString(value);
    if (!slug) return undefined;
    const found = await es.findMany('api::category.category', {
      filters: { slug },
      limit: 1,
    });
    const entity = Array.isArray(found) ? found[0] : null;
    return entity?.id ? Number(entity.id) : undefined;
  };

  const resolveAuthorId = async (value: unknown): Promise<number | undefined> => {
    const direct = parseRelationId(value);
    if (direct) return direct;
    const raw = parseString(value);
    if (!raw) return undefined;
    const isEmail = raw.includes('@');

    const candidates = await es.findMany('api::author.author', {
      filters: isEmail ? { email: raw } : { $or: [{ name: raw }, { nameHindi: raw }] },
      limit: 1,
    });
    const match = Array.isArray(candidates) ? candidates[0] : null;
    if (match?.id) return Number(match.id);

    if (isEmail) return undefined;

    const slug = raw
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const email = `${slug || 'author'}-${Date.now()}@rampurnews.local`;
    const created = await es.create('api::author.author', {
      data: {
        name: raw,
        nameHindi: raw,
        email,
        role: 'author',
      },
    });
    return created?.id ? Number(created.id) : undefined;
  };

  const resolveTagIds = async (value: unknown): Promise<number[] | undefined> => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;

    // Normalise each entry to { name, slug, nameHindi }
    // Accepts both:
    //   - { name, slug } objects  (new format from AI pipeline)
    //   - plain strings           (legacy format — name = slug = the string)
    type TagInput = { name: string; slug: string; nameHindi: string };
    const tagInputs: TagInput[] = [];
    for (const t of value as any[]) {
      if (t && typeof t === 'object' && !Array.isArray(t)) {
        const name = typeof t.name === 'string' ? t.name.trim() : '';
        const slug = typeof t.slug === 'string' ? t.slug.trim() : '';
        if (!name && !slug) continue;
        // nameHindi: use name if it contains Devanagari, otherwise empty
        const hasDevanagari = /[\u0900-\u097F]/.test(name);
        tagInputs.push({
          name: name || slug,
          slug: slug || name,
          nameHindi: hasDevanagari ? name : '',
        });
      } else if (typeof t === 'string') {
        const s = t.trim();
        if (!s) continue;
        tagInputs.push({ name: s, slug: s, nameHindi: '' });
      }
    }
    if (tagInputs.length === 0) return [];

    const ids: number[] = [];
    for (const input of tagInputs) {
      // Look up by slug first (most reliable unique key), then by name
      let existing = await es.findMany('api::tag.tag', {
        filters: { slug: input.slug },
        limit: 1,
      });
      let match = Array.isArray(existing) ? existing[0] : null;

      if (!match) {
        existing = await es.findMany('api::tag.tag', {
          filters: { name: input.name },
          limit: 1,
        });
        match = Array.isArray(existing) ? existing[0] : null;
      }

      if (match?.id) {
        // Update nameHindi if it was previously empty and we now have a Hindi name
        if (input.nameHindi && !match.nameHindi) {
          await es.update('api::tag.tag', match.id, {
            data: { nameHindi: input.nameHindi },
          });
        }
        ids.push(Number(match.id));
        continue;
      }

      // Create new tag — pass slug explicitly so Strapi's UID field uses it
      // rather than auto-generating from the Hindi name (which would produce
      // a Devanagari slug that breaks URL routing).
      // noindex defaults to true (schema default) — recalcTagCount will flip it
      // to false once the tag accumulates ≥ 3 published articles.
      const created = await es.create('api::tag.tag', {
        data: {
          name: input.name,
          nameHindi: input.nameHindi || undefined,
          slug: input.slug,
          articleCount: 0,
          noindex: true,
        },
      });
      if (created?.id) ids.push(Number(created.id));
    }

    // Recalculate articleCount + noindex for every tag we just touched.
    // Fire-and-forget — non-fatal if it fails.
    if (ids.length > 0) {
      const { recalcTagCount } = await import('../../tag/controllers/tag').catch(() => ({ recalcTagCount: null }));
      if (recalcTagCount) {
        void Promise.all(ids.map((id) => recalcTagCount(strapi, id)));
      }
    }

    return ids;
  };

  const resolveUploadFileIdByUrl = async (value: unknown, origin: string): Promise<number | undefined> => {
    const raw = parseString(value);
    if (!raw) return undefined;
    try {
      const url = new URL(raw, origin);
      const pathname = url.pathname;
      const existing = await es.findMany('plugin::upload.file', { filters: { url: pathname }, limit: 1 });
      const match = Array.isArray(existing) ? existing[0] : null;
      return match?.id ? Number(match.id) : undefined;
    } catch {
      return undefined;
    }
  };

  const validateFeaturedImageWidth = async (imageId?: number | null) => {
    if (!imageId) return;
    const file = await es.findOne('plugin::upload.file', imageId, { fields: ['width', 'height'] });
    const width = typeof file?.width === 'number' ? file.width : undefined;
    const height = typeof file?.height === 'number' ? file.height : undefined;
    if ((width !== undefined && width < 1200) || (height !== undefined && height < 630)) {
      throw new Error('FEATURED_IMAGE_TOO_SMALL');
    }
  };

  const buildStrapiArticleData = async (input: any, origin: string, isPartial: boolean) => {
    const data: Record<string, any> = {};

    const set = (key: string, val: any) => {
      if (isPartial) {
        if (val !== undefined) data[key] = val;
        return;
      }
      if (val !== undefined) data[key] = val;
    };

    if (!isPartial || 'title' in input) set('title', parseString(input.title) ?? input.title ?? undefined);
    if (!isPartial || 'slug' in input) set('slug', parseString(input.slug) ?? input.slug ?? undefined);
    if (!isPartial || 'excerpt' in input) set('excerpt', parseString(input.excerpt) ?? input.excerpt ?? undefined);
    if (!isPartial || 'content' in input) set('content', parseString(input.content) ?? input.content ?? undefined);
    if (!isPartial || 'short_headline' in input) {
      const explicit = parseString(input.short_headline) ?? input.short_headline ?? undefined;
      const title = parseString(input.title) ?? (typeof data.title === 'string' ? data.title : '');
      set('short_headline', explicit || truncateText(title, 65) || undefined);
    }
    if (!isPartial || 'readTime' in input) set('readTime', parseString(input.readTime) ?? input.readTime ?? undefined);
    if (!isPartial || 'videoUrl' in input) set('videoUrl', parseString(input.videoUrl) ?? input.videoUrl ?? undefined);
    if (!isPartial || 'videoType' in input) set('videoType', parseString(input.videoType) ?? input.videoType ?? undefined);
    if (!isPartial || 'videoTitle' in input) set('videoTitle', parseString(input.videoTitle) ?? input.videoTitle ?? undefined);
    if (!isPartial || 'meta_description' in input || 'seoDescription' in input) {
      const explicit = parseString(input.meta_description) ?? input.meta_description ?? undefined;
      const fromSeoDescription = parseString(input.seoDescription) ?? input.seoDescription ?? undefined;
      const fallback = buildSeoDescription(parseString(input.excerpt) ?? '', parseString(input.content) ?? '');
      set('meta_description', explicit || fromSeoDescription || fallback || undefined);
    }
    if (!isPartial || 'focus_keyword' in input) set('focus_keyword', parseString(input.focus_keyword) ?? input.focus_keyword ?? undefined);
    if (!isPartial || 'location' in input) set('location', parseString(input.location) ?? input.location ?? undefined);
    if (!isPartial || 'news_category' in input) set('news_category', parseString(input.news_category) ?? input.news_category ?? undefined);
    if (!isPartial || 'seoTitle' in input) set('seoTitle', parseString(input.seoTitle) ?? input.seoTitle ?? undefined);
    if (!isPartial || 'ogTitle' in input) set('ogTitle', parseString(input.ogTitle) ?? input.ogTitle ?? undefined);
    if (!isPartial || 'ogDescription' in input) set('ogDescription', parseString(input.ogDescription) ?? input.ogDescription ?? undefined);
    if (!isPartial || 'canonicalUrl' in input) set('canonicalUrl', parseString(input.canonicalUrl) ?? input.canonicalUrl ?? undefined);
    if (!isPartial || 'newsKeywords' in input) set('newsKeywords', parseString(input.newsKeywords) ?? input.newsKeywords ?? undefined);
    if (!isPartial || 'schemaJson' in input) {
      const schemaCandidate = input.schemaJson;
      if (schemaCandidate && (typeof schemaCandidate === 'object' || Array.isArray(schemaCandidate))) {
        set('schemaJson', schemaCandidate);
      }
    }

    // SEO keyword arrays — stored as JSON fields in Strapi
    if (!isPartial || 'short_tail_keywords' in input || 'seoShortTailKeywords' in input) {
      const val = input.seoShortTailKeywords ?? input.short_tail_keywords;
      if (Array.isArray(val)) set('seoShortTailKeywords', val);
    }
    if (!isPartial || 'long_tail_keywords' in input || 'seoLongTailKeywords' in input) {
      const val = input.seoLongTailKeywords ?? input.long_tail_keywords;
      if (Array.isArray(val)) set('seoLongTailKeywords', val);
    }
    if (!isPartial || 'seoKeywords' in input || 'seoKeywordsJson' in input) {
      const val = input.seoKeywordsJson ?? input.seoKeywords;
      if (val && typeof val === 'object') set('seoKeywordsJson', val);
    }

    if (!isPartial || 'isFeatured' in input) set('isFeatured', parseBoolean(input.isFeatured));
    if (!isPartial || 'isBreaking' in input) set('isBreaking', parseBoolean(input.isBreaking));
    if (!isPartial || 'isEditorsPick' in input) set('isEditorsPick', parseBoolean(input.isEditorsPick));
    if (!isPartial || 'contentType' in input) set('contentType', parseString(input.contentType) ?? input.contentType ?? undefined);
    if (!isPartial || 'views' in input) set('views', parseNumber(input.views));

    if (!isPartial || 'category' in input) {
      let categoryInput: unknown = input.category;
      const rawContentType =
        Object.prototype.hasOwnProperty.call(input, 'contentType') && input.contentType !== undefined
          ? input.contentType
          : (data as any).contentType;
      const contentType =
        typeof rawContentType === 'string' ? rawContentType.trim() : undefined;
      if (
        contentType &&
        (EDITORIAL_CONTENT_TYPES as readonly string[]).includes(contentType)
      ) {
        categoryInput = EDITORIAL_CATEGORY_SLUG;
      }

      const categoryId = await resolveCategoryId(categoryInput);
      if (!categoryId && !isPartial) {
        throw new Error('CATEGORY_REQUIRED');
      }
      if (categoryId) set('category', categoryId);
    }

    if (!isPartial || 'author' in input) {
      const authorId = await resolveAuthorId(input.author);
      if (!authorId && !isPartial) {
        throw new Error('AUTHOR_REQUIRED');
      }
      if (authorId) set('author', authorId);
    }

    if (!isPartial || 'tags' in input) {
      const tagIds = await resolveTagIds(input.tags);
      if (tagIds !== undefined) set('tags', tagIds);
    }

    const primaryCategoryId = typeof data.category === 'number' ? data.category : undefined;
    if (!isPartial || 'categories' in input) {
      let extraCategoryIds: number[] | undefined;
      if (Array.isArray(input.categories)) {
        const numericIds: number[] = [];
        const slugCandidates: string[] = [];
        for (const raw of input.categories as any[]) {
          const id = parseRelationId(raw);
          if (typeof id === 'number') {
            numericIds.push(id);
          } else {
            const slug = parseString(raw);
            if (slug) slugCandidates.push(slug);
          }
        }

        const slugIds: number[] = [];
        if (slugCandidates.length > 0) {
          const uniqueSlugs = Array.from(new Set(slugCandidates));
          const found = await es.findMany('api::category.category', {
            filters: { slug: { $in: uniqueSlugs } },
            limit: uniqueSlugs.length,
          });
          if (Array.isArray(found)) {
            for (const cat of found) {
              if (cat?.id) slugIds.push(Number(cat.id));
            }
          }
        }

        extraCategoryIds = [...numericIds, ...slugIds];
      }

      const ids = new Set<number>();
      if (primaryCategoryId) ids.add(primaryCategoryId);
      if (extraCategoryIds) {
        for (const id of extraCategoryIds) {
          ids.add(id);
        }
      }

      if (ids.size > 0) {
        set('categories', Array.from(ids));
      }
    }

    if (
      !isPartial ||
      'featured_image' in input ||
      'featuredImageId' in input ||
      'featuredImage' in input ||
      'featuredMediaId' in input
    ) {
      const featuredImageRaw =
        input.featuredImageId ?? input.featuredMediaId ?? input.featuredImage ?? input.featured_image;
      const featuredImageId = parseRelationId(featuredImageRaw);
      const featuredImageUrl = typeof featuredImageRaw === 'string' ? parseString(featuredImageRaw) : undefined;

      if (featuredImageId) {
        set('featured_image', featuredImageId);
      } else if (featuredImageRaw === null || (featuredImageRaw === '' && !featuredImageUrl)) {
        set('featured_image', null);
      } else if (featuredImageUrl) {
        const fileId = await resolveUploadFileIdByUrl(featuredImageUrl, origin);
        if (fileId) set('featured_image', fileId);
      }
    }

    if (!isPartial) {
      const slugCandidate = parseString(input.slug);
      if (!slugCandidate) {
        const titleCandidate = parseString(input.title) ?? '';
        data.slug = await ensureUniqueSlug(titleCandidate);
      } else {
        data.slug = await ensureUniqueSlug(slugCandidate);
      }
    } else if ('slug' in input) {
      // Partial update (edit): only process slug when it is explicitly sent.
      // This allows editors to change the slug without it being silently dropped.
      const slugCandidate = parseString(input.slug);
      if (slugCandidate) {
        // Do NOT call ensureUniqueSlug here — the update handler does that
        // after resolving the numeric id for correct self-exclusion.
        data.slug = slugCandidate;
      }
    }

    return data;
  };

  return {
    async featured(ctx) {
      // Set caching headers for CDN
      ctx.set('Cache-Control', 'public, max-age=60');
      
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = ctx.request.origin || '';
      const entities = await es.findMany('api::article.article', {
        filters: { 
          isFeatured: true,
        },
        // Using deterministic sorting with secondary id sort
        sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }],
        populate: articlePopulate,
        fields: LIST_FIELDS,
        limit,
        publicationState: 'live',
      });
      return (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true }));
    },

    async breaking(ctx) {
      // Set caching headers for CDN
      ctx.set('Cache-Control', 'public, max-age=60');
      
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = ctx.request.origin || '';
      const now = Date.now();
      const cutoff = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const entities = await es.findMany('api::article.article', {
        filters: { 
          isBreaking: true,
          publishedAt: { $gte: cutoff },
        },
        // Using deterministic sorting with secondary id sort
        sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }],
        populate: articlePopulate,
        fields: LIST_FIELDS,
        limit,
        publicationState: 'live',
      });
      return (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true }));
    },

    async hero(ctx) {
      // Set caching headers for CDN
      ctx.set('Cache-Control', 'public, max-age=60');
      
      const totalLimit = parseLimit(ctx.query.limit, 15);
      const limit = Math.max(1, Math.min(totalLimit, MAX_LIMIT));
      const origin = ctx.request.origin || '';
      const now = Date.now();
      const cutoff = new Date(now - 48 * 60 * 60 * 1000).toISOString();

      const featuredLimit = Math.min(3, limit);
      const breakingLimit = Math.max(0, limit - featuredLimit);

      const [featuredEntities, breakingCandidates] = await Promise.all([
        es.findMany('api::article.article', {
          filters: {
            isFeatured: true,
          },
          // Using deterministic sorting with secondary id sort
          sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }],
          populate: articlePopulate,
          fields: LIST_FIELDS,
          limit: featuredLimit,
          publicationState: 'live',
        }),
        es.findMany('api::article.article', {
          filters: {
            isBreaking: true,
            publishedAt: { $gte: cutoff },
          },
          // Using deterministic sorting with secondary id sort
          sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }],
          populate: articlePopulate,
          fields: LIST_FIELDS,
          limit: limit * 2,
          publicationState: 'live',
        }),
      ]);

      const featuredList = Array.isArray(featuredEntities) ? featuredEntities : [];
      const featuredIds = new Set((featuredList as any[]).map((e) => e.id));

      const breakingListRaw = Array.isArray(breakingCandidates) ? (breakingCandidates as any[]) : [];
      const breakingList = breakingListRaw.filter((e) => !featuredIds.has(e.id)).slice(0, breakingLimit);

      let combined = [...featuredList, ...breakingList];

      if (combined.length === 0) {
        combined = await es.findMany('api::article.article', {
          filters: {},
          // Using deterministic sorting with secondary id sort
          sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }],
          populate: articlePopulate,
          fields: LIST_FIELDS,
          limit,
          publicationState: 'live',
        });
      }

      return (combined as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true }));
    },

    async newsSitemap(ctx) {
      const origin = getPublicOrigin(ctx) || SITE_URL;
      const now = new Date();
      const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

      const entities = await es.findMany('api::article.article', {
        filters: {
          publishedAt: { $gte: since },
        },
        // Using deterministic sorting: publishedAt desc, id desc
        sort: [{ publishedAt: 'desc' }, { id: 'desc' }] as any,
        limit: 1000,
        populate: { featured_image: true, category: true },
        publicationState: 'live',
      });

      const urls = (entities as any[]).map((entity) => {
        const slug = entity?.slug ? String(entity.slug) : '';
        const categorySlug = entity?.category?.slug ? String(entity.category.slug) : '';
        const canonicalRaw = entity?.canonicalUrl ? String(entity.canonicalUrl).trim() : '';
        const canonical =
          canonicalRaw && /^https?:\/\//i.test(canonicalRaw)
            ? canonicalRaw
            : canonicalRaw
              ? `${origin}/${canonicalRaw.replace(/^\/+/, '')}`
              : '';
        const loc = (canonical || `${origin}/${categorySlug}/${slug}`).replace(/\/+/g, '/').replace(':/', '://');
        const publishedIso = formatIso(entity?.publishedAt || entity?.createdAt) || now.toISOString();
        const lastmod = formatIso(entity?.updatedAt || entity?.publishedAt) || publishedIso;
        const title = entity?.short_headline ? String(entity.short_headline) : entity?.title ? String(entity.title) : '';

        return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <news:news>
      <news:publication>
        <news:name>Rampur News</news:name>
        <news:language>hi</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(publishedIso)}</news:publication_date>
      <news:title>${escapeXml(title)}</news:title>
    </news:news>
  </url>`;
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join('')}
</urlset>`;

      ctx.type = 'application/xml';
      return xml;
    },

    async sitemap(ctx) {
      const origin = getPublicOrigin(ctx) || SITE_URL;
      const now = new Date().toISOString();

      const [articles, categories, authors] = await Promise.all([
        es.findMany('api::article.article', {
          filters: { },
          // Using deterministic sorting: publishedAt desc, id desc
          sort: [{ publishedAt: 'desc' }, { id: 'desc' }] as any,
          // Increase sitemap limit to 10,000 to cover more old articles
          limit: 10000,
          populate: { category: true },
          publicationState: 'live',
        }),
        es.findMany('api::category.category', { limit: 2000 }),
        es.findMany('api::author.author', { limit: 2000 }),
      ]);

      const staticPaths = ['/', '/rampur', '/up', '/national', '/politics', '/crime', '/education-jobs', '/business', '/entertainment', '/sports', '/health'];

      const urls = [
        ...staticPaths.map((path) => ({
          loc: `${origin}${path}`,
          lastmod: now,
        })),
        ...(categories as any[]).map((c) => ({
          loc: `${origin}/${c?.path || c?.slug || ''}`.replace(/\/+/g, '/').replace(':/', '://'),
          lastmod: now,
        })),
        ...(authors as any[]).map((a) => ({
          loc: `${origin}/authors/${a?.slug || ''}`.replace(/\/+/g, '/').replace(':/', '://'),
          lastmod: now,
        })),
        ...(articles as any[]).map((a) => {
          const categorySlug = a?.category?.slug ? String(a.category.slug) : '';
          const canonicalRaw = a?.canonicalUrl ? String(a.canonicalUrl).trim() : '';
          const canonical =
            canonicalRaw && /^https?:\/\//i.test(canonicalRaw)
              ? canonicalRaw
              : canonicalRaw
                ? `${origin}/${canonicalRaw.replace(/^\/+/, '')}`
                : '';
          const loc = (canonical || `${origin}/${categorySlug}/${a?.slug || ''}`).replace(/\/+/g, '/').replace(':/', '://');
          const lastmod = formatIso(a?.updatedAt || a?.publishedAt) || now;
          return { loc, lastmod };
        }),
      ].filter((u) => u.loc && !u.loc.includes('/tags') && !u.loc.includes('/tag') && !u.loc.includes('/admin') && !u.loc.includes('/api'));

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
  </url>`,
  )
  .join('')}
</urlset>`;

      ctx.type = 'application/xml';
      return xml;
    },

    async robots(ctx) {
      const origin = getPublicOrigin(ctx) || SITE_URL;
      ctx.type = 'text/plain';
      return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${origin}/sitemap.xml
Sitemap: ${origin}/news-sitemap.xml
`;
    },

    async trending(ctx) {
      // Cache trending for 5 minutes — it's computed from views/shares/recency
      // and doesn't need to be real-time. Without this header every request
      // fetches 250 articles and scores them in Node.js memory.
      ctx.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=300');
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = getPublicOrigin(ctx);
      const entities = await trendingService.getTrendingEntities(strapi, { limit });
      return (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true }));
    },

    async byCategory(ctx) {
      ctx.set('Cache-Control', 'public, max-age=60');

      // Support both pagination formats: pagination[page] or offset/limit
      const pagination = ctx.query.pagination as any;
      const page = typeof pagination?.page === 'number' ? pagination.page : 1;
      const pageSize = typeof pagination?.pageSize === 'number' ? pagination.pageSize : parseLimit(ctx.query.limit, 100);
      const offset = parseNumber(ctx.query.offset) ?? ((page - 1) * pageSize);
      const limit = pageSize;
      const categorySlug = parseString(ctx.params.slug);

      if (!categorySlug) {
        ctx.badRequest('Category slug is required');
        return;
      }

      const origin = ctx.request.origin || '';

      const filters = {
        $or: [
          { category: { slug: { $eq: categorySlug } } },
          { categories: { slug: { $eq: categorySlug } } },
        ],
      };

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          // Using deterministic sorting: publishedAt desc, id desc
          sort: [{ publishedAt: 'desc' }, { id: 'desc' }] as any,
          populate: articlePopulate,
          fields: LIST_FIELDS,
          start: offset,
          limit,
          publicationState: 'live',
        }),
        es.count('api::article.article', { filters, publicationState: 'live' }),
      ]);

      // Calculate actual page info for response
      const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
      const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

      return {
        data: (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true })),
        total,
        page: currentPage,
        pageSize: limit,
        totalPages,
      };
    },

    async search(ctx) {
      const limit = parseLimit(ctx.query.limit, 25);
      const offset = parseNumber(ctx.query.offset) ?? 0;
      const q = parseString(ctx.query.q);
      if (!q) {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: limit,
          totalPages: 0,
        };
      }
      const origin = ctx.request.origin || '';

      const filters: Record<string, any> = {
        $or: [
          { title: { $containsi: q } },
          { excerpt: { $containsi: q } },
          { content: { $containsi: q } },
        ],
      };

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          // Using deterministic sorting with secondary id sort
          sort: [{ [DEFAULT_SORT_FIELD]: 'desc' }, { id: 'desc' }] as any,
          populate: articlePopulate,
          fields: LIST_FIELDS,
          start: offset,
          limit,
          publicationState: 'live',
        }),
        es.count('api::article.article', { filters, publicationState: 'live' }),
      ]);

      const pageSize = limit;
      const page = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1;
      const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

      return {
        data: (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true })),
        total,
        page,
        pageSize,
        totalPages,
      };
    },

    async find(ctx) {
      // Set caching headers for CDN
      ctx.set('Cache-Control', 'public, max-age=60');
      
      const origin = getPublicOrigin(ctx);
      const q: any = await (this as any).sanitizeQuery(ctx);
      const filters: Record<string, any> = q.filters ? JSON.parse(JSON.stringify(q.filters)) : {};
      
      // Support both pagination formats: pagination[page] or start/limit
      const pagination = q.pagination as any;
      const pageNum = typeof pagination?.page === 'number' ? pagination.page : 1;
      const pageSizeNum = typeof pagination?.pageSize === 'number' ? pagination.pageSize : (typeof q.limit === 'number' ? Math.min(q.limit, MAX_LIMIT) : 100);
      const start = typeof q.start === 'number' ? q.start : ((pageNum - 1) * pageSizeNum);
      const limit = typeof q.limit === 'number' ? Math.min(q.limit, MAX_LIMIT) : pageSizeNum;
      
      // Use deterministic sorting: publishedAt desc, id desc
      const sort = q.sort && Array.isArray(q.sort) && q.sort.length > 0 
        ? q.sort 
        : [{ publishedAt: 'desc' }, { id: 'desc' }];
      // SECURITY: Never allow publicationState to be overridden by query params
      // on the public find endpoint. Always enforce 'live'.
      const publicationState = 'live';

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          sort,
          populate: articlePopulate,
          fields: LIST_FIELDS,
          start,
          limit,
          publicationState,
        }),
        es.count('api::article.article', { filters, publicationState }),
      ]);

      const pageSize = limit;
      const page = pageSize > 0 ? Math.floor(start / pageSize) + 1 : 1;
      const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

      return {
        data: (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true })),
        total,
        page,
        pageSize,
        totalPages,
      };
    },

    async adminFind(ctx) {
      const limit = parseLimit(ctx.query.limit, 25);
      const offset = parseNumber(ctx.query.offset) ?? 0;
      const category = parseString(ctx.query.category);
      const parent = parseString(ctx.query.parent);
      const status = parseString(ctx.query.status);
      const featured = parseBoolean(ctx.query.featured);
      const breaking = parseBoolean(ctx.query.breaking);
      const search = parseString(ctx.query.search);
      const author = parseString(ctx.query.author);
      const orderBy = parseString(ctx.query.orderBy) ?? DEFAULT_SORT_FIELD;
      const order = (parseString(ctx.query.order) ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const origin = ctx.request.origin || '';

      const filters: Record<string, any> = {};
      if (category || parent) {
        filters.$and = filters.$and || [];
        const or: any[] = [];
        if (category) {
          or.push({ category: { slug: category } }, { categories: { slug: category } });
        }
        if (parent) {
          or.push({ category: { parent: { slug: parent } } }, { categories: { parent: { slug: parent } } });
        }
        filters.$and.push({ $or: or });
      }
      if (featured !== undefined) filters.isFeatured = featured;
      if (breaking !== undefined) {
        filters.isBreaking = breaking;
        if (breaking) {
          const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          filters.publishedAt = { $gte: cutoff };
        }
      }

      if (author) {
        filters.author = author.includes('@') ? { email: author } : { $or: [{ name: author }, { nameHindi: author }] };
      }

      if (search) {
        filters.$or = [
          { title: { $containsi: search } },
          { excerpt: { $containsi: search } },
          { content: { $containsi: search } },
        ];
      }

      if (status === 'published') {
        // Note: entityService does not support status: 'published' filter directly.
        // publishedAt is the correct way to filter published articles in entityService.
        // This is admin-only — never used for public API responses.
        filters.publishedAt = { $notNull: true };
      } else if (status === 'draft') {
        filters.publishedAt = { $null: true };
      }

      const sortKeyWhitelist = new Set(['publishedAt', 'publishedDate', 'views', 'title', 'createdAt', 'updatedAt']);
      const sortFieldRaw = sortKeyWhitelist.has(orderBy) ? orderBy : 'publishedAt';
      const sortField = sortFieldRaw === 'publishedDate' ? 'publishedAt' : sortFieldRaw;
      const sortArray = [{ [sortField]: order }];

      const sortDiagnostics = String(process.env.SORT_DIAGNOSTICS ?? '').trim().toLowerCase();
      if (sortDiagnostics === '1' || sortDiagnostics === 'true' || sortDiagnostics === 'yes') {
        strapi.log.info(
          JSON.stringify({
            type: 'sort_query',
            endpoint: 'adminFind',
            requestId: ctx.state?.requestId,
            limit,
            offset,
            filters: {
              category,
              parent,
              status,
              featured,
              breaking,
              author,
              search: search ? true : false,
            },
            sort: sortArray,
            publicationState: 'preview',
          }),
        );
      }

      // IMPORTANT: Ensure we fetch draft AND published content for Admin Dashboard
      // Strapi v5 Entity Service defaults to publicationState: 'live' if not specified
      // We must explicitly set 'preview' to see everything.
      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          sort: sortArray,
          populate: articlePopulate,
          fields: LIST_FIELDS,
          publicationState: 'preview', 
          start: offset,
          limit,
        }),
        es.count('api::article.article', { filters, publicationState: 'preview' }),
      ]);

      const pageSize = limit;
      const page = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1;
      const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

      return {
        data: (entities as any[]).map((e) => normalizeArticle(e, origin, { excludeContent: true })),
        total,
        page,
        pageSize,
        totalPages,
      };
    },

    async adminFindOne(ctx) {
      const id = ctx.params.id;
      const origin = getPublicOrigin(ctx);
      const entity = await es.findOne('api::article.article', id, {
        populate: articlePopulate,
        publicationState: 'preview',
      });
      if (!entity) {
        ctx.notFound('Article not found');
        return;
      }
      return normalizeArticle(entity, origin);
    },

    async findOne(ctx) {
      const id = ctx.params.id;
      const origin = getPublicOrigin(ctx);
      const entity = await es.findOne('api::article.article', id, {
        populate: articlePopulate,
        publicationState: 'live',
      });
      if (!entity) {
        ctx.notFound('Article not found');
        return;
      }
      return normalizeArticle(entity, origin);
    },

    async adminFindBySlug(ctx) {
      const origin = getPublicOrigin(ctx);
      const slug = ctx.params.slug;
      const entities = await es.findMany('api::article.article', {
        filters: { slug },
        populate: articlePopulate,
        publicationState: 'preview',
        limit: 1,
      });
      const entity = (entities as any[])[0];
      if (!entity) {
        ctx.notFound('Article not found');
        return;
      }
      return normalizeArticle(entity, origin);
    },

    async findBySlug(ctx) {
      const slug = ctx.params.slug;
      const origin = getPublicOrigin(ctx);

      // Preview mode: ?preview=true&token=SECRET or authenticated request
      const previewSecret = process.env.PREVIEW_SECRET;
      const requestToken = parseString(ctx.query?.token);
      const hasAuth = Boolean(ctx.state?.user);
      const tokenValid = Boolean(previewSecret && requestToken && requestToken === previewSecret);
      const isPreview = ctx.query?.preview === 'true' && (hasAuth || tokenValid);

      const status = isPreview ? 'draft' : 'published';

      strapi.log.debug(JSON.stringify({
        type: 'findBySlug_request',
        slug,
        status,
        isPreview,
        hasAuth,
        tokenValid,
      }));

      // PRIMARY: Strapi v5 Document Service — status: 'published' | 'draft'
      // This works for articles published via the Document Service publish() action.
      const docService = (strapi as any).documents('api::article.article');

      const results = await docService.findMany({
        filters: { slug },
        status,
        populate: articlePopulate,
        limit: 1,
      });

      let entity = Array.isArray(results) ? results[0] : null;

      // FALLBACK: entityService with publicationState:'live'
      // Required for articles whose publishedAt was set directly (SQL, migration,
      // or entityService.update) without going through Document Service publish().
      // In those cases the Document Service has no live version, but the article
      // IS published (publishedAt is non-null) and must be served.
      if (!entity && !isPreview) {
        const fallbackResults = await es.findMany('api::article.article', {
          filters: { slug },
          populate: articlePopulate,
          publicationState: 'live',
          limit: 1,
        });
        const fallback = Array.isArray(fallbackResults) ? fallbackResults[0] : null;
        // Only use the fallback if publishedAt is actually set — belt-and-suspenders
        // guard so we never accidentally serve a draft via this path.
        if (fallback?.publishedAt) {
          entity = fallback;
          strapi.log.debug(JSON.stringify({
            type: 'findBySlug_fallback_used',
            slug,
            entityId: fallback.id,
            documentId: fallback.documentId,
          }));
        }
      }

      strapi.log.debug(JSON.stringify({
        type: 'findBySlug_result',
        slug,
        status,
        found: Boolean(entity),
        entityStatus: entity?.status,
        documentId: entity?.documentId,
      }));

      if (!entity) {
        ctx.notFound('Article not found');
        return;
      }

      return normalizeArticle(entity, origin);
    },

    async create(ctx) {
      const origin = getPublicOrigin(ctx);
      const input = extractData(ctx.request.body);
      try {
        const explicitId = parseNumber((input as any)?.id);
        const explicitDocumentId = parseString((input as any)?.documentId);
        const requestedSlugRaw = parseString((input as any)?.slug) || parseString((input as any)?.title) || '';
        const requestedSlug = requestedSlugRaw ? normalizeSlugValue(requestedSlugRaw) : '';

        let existingEntity: any = null;

        if (explicitId) {
          existingEntity = await es.findOne('api::article.article', explicitId, {
            populate: articlePopulate,
            publicationState: 'preview',
          });
        } else if (explicitDocumentId) {
          const foundByDocument = await es.findMany('api::article.article', {
            filters: { documentId: explicitDocumentId },
            publicationState: 'preview',
            populate: articlePopulate,
            sort: [{ updatedAt: 'desc' }],
            limit: 1,
          });
          existingEntity = Array.isArray(foundByDocument) ? foundByDocument[0] : null;
        } else if (requestedSlug) {
          const foundBySlug = await es.findMany('api::article.article', {
            filters: { slug: requestedSlug },
            publicationState: 'preview',
            populate: articlePopulate,
            sort: [{ updatedAt: 'desc' }],
            limit: 1,
          });
          existingEntity = Array.isArray(foundBySlug) ? foundBySlug[0] : null;
        }

        const isUpsert = Boolean(existingEntity?.id);
        const data = await buildStrapiArticleData(input, origin, isUpsert);
        if (typeof data.slug === 'string' && data.slug.trim()) {
          // For upserts, exclude the existing entity's numeric id so the slug
          // uniqueness check doesn't flag the article's own slug as a conflict.
          const excludeNumericId = isUpsert ? Number(existingEntity.id) : undefined;
          data.slug = await ensureUniqueSlug(data.slug, excludeNumericId);
        }
        await validateFeaturedImageWidth(
          typeof data.featured_image === 'number' ? data.featured_image : undefined,
        );
        const entity = isUpsert
          ? await es.update('api::article.article', existingEntity.id, {
              data,
              populate: articlePopulate,
            })
          : await es.create('api::article.article', {
              data,
              populate: articlePopulate,
            });
        return normalizeArticle(entity, origin);
      } catch (error: any) {
        if (error?.message === 'CATEGORY_REQUIRED') {
          ctx.badRequest('Category is required');
          return;
        }
        if (error?.message === 'AUTHOR_REQUIRED') {
          ctx.badRequest('Author is required');
          return;
        }
        if (error?.message === 'FEATURED_IMAGE_TOO_SMALL') {
          ctx.badRequest('Featured image must be at least 1200x630px');
          return;
        }
        throw error;
      }
    },

    async update(ctx) {
      const id = ctx.params.id;
      const origin = getPublicOrigin(ctx);
      const input = extractData(ctx.request.body);
      const data = await buildStrapiArticleData(input, origin, true);
      if (typeof data.slug === 'string' && data.slug.trim()) {
        // Resolve the numeric entity ID so ensureUniqueSlug can correctly
        // exclude the current article when checking for slug conflicts.
        // ctx.params.id may be a documentId (string) in Strapi v5, so we
        // look up the numeric id first.
        let numericId = parseNumber(id);
        if (!numericId) {
          // id is a documentId — find the numeric id
          const found = await es.findMany('api::article.article', {
            filters: { documentId: id },
            fields: ['id'],
            limit: 1,
            publicationState: 'preview',
          });
          numericId = Array.isArray(found) && found[0]?.id ? Number(found[0].id) : undefined;
        }
        data.slug = await ensureUniqueSlug(data.slug, numericId);
      }
      if (typeof data.featured_image === 'number') {
        await validateFeaturedImageWidth(data.featured_image);
      }
      const entity = await es.update('api::article.article', id, {
        data,
        populate: articlePopulate,
      });
      // Invalidate Redis cache so stale article data is not served after update
      void invalidateArticleCache(redisCacheConfig, id);
      return normalizeArticle(entity, origin);
    },

    async publish(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) { ctx.badRequest('Invalid id'); return; }

      const origin = getPublicOrigin(ctx);
      const docService = (strapi as any).documents('api::article.article');

      // Resolve documentId — ctx.params.id may be a numeric id or a documentId string
      let documentId: string | undefined;
      const numericId = parseNumber(id);
      if (numericId) {
        // Numeric id: look up via entityService to get documentId
        const found = await es.findOne('api::article.article', numericId, {
          fields: ['id', 'documentId'],
          publicationState: 'preview',
        });
        if (!found) { ctx.notFound('Article not found'); return; }
        documentId = parseString((found as any)?.documentId) || id;
      } else {
        // Already a documentId string
        documentId = id;
      }

      strapi.log.info(JSON.stringify({
        type: 'publish_attempt',
        documentId,
        numericId: numericId || undefined,
        timestamp: new Date().toISOString(),
      }));

      // Update workflowStatus to 'approved' on the draft version before publishing.
      // The Document Service publish action does NOT update custom fields, so we
      // must do this explicitly. This ensures the live version carries 'approved'.
      // v5 update() always targets the draft version by default — no status param needed.
      try {
        await docService.update({
          documentId,
          data: { workflowStatus: 'approved' },
        });
      } catch (updateErr) {
        // Non-fatal — log and continue. The publish will still succeed.
        strapi.log.warn(JSON.stringify({
          type: 'publish_workflow_update_failed',
          documentId,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        }));
      }

      // Publish via Document Service (Strapi v5 canonical API)
      // This creates/updates the LIVE version from the current draft.
      await docService.publish({ documentId });

      strapi.log.info(JSON.stringify({
        type: 'publish_success',
        event: 'ARTICLE_PUBLISHED',
        documentId,
        timestamp: new Date().toISOString(),
      }));

      // Return the live version using Document Service with status: 'published'
      // Correct v5 signature: findOne({ documentId, status, populate })
      const entity = await docService.findOne({ documentId, status: 'published', populate: articlePopulate });
      if (!entity) {
        strapi.log.error(JSON.stringify({
          type: 'publish_live_version_missing',
          documentId,
          message: 'Document published but live version not found — possible Document Service issue',
        }));
        ctx.internalServerError('Published but live version not found');
        return;
      }

      // ─── SINGLE-SOURCE CACHE INVALIDATION ────────────────────────────────
      // Revalidation fires ONCE here — never in lifecycle hooks.
      // This prevents duplicate calls on rapid saves and race conditions.
      void triggerFrontendRevalidation(strapi, entity);
      // Invalidate Redis cache so the published article is served fresh
      void invalidateArticleCache(redisCacheConfig, documentId);
      // Batch-recalc all tag counts (non-blocking) after publish
      void batchRecalcAllTagCounts(strapi);

      return normalizeArticle(entity, origin);
    },

    async approve(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) { ctx.badRequest('Invalid id'); return; }

      const origin = getPublicOrigin(ctx);
      const entity = await es.update('api::article.article', id, {
        data: { workflowStatus: 'approved' },
        populate: articlePopulate,
      });
      if (!entity) { ctx.notFound('Article not found'); return; }
      return normalizeArticle(entity, origin);
    },

    async reject(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) { ctx.badRequest('Invalid id'); return; }

      const body = ctx.request.body?.data ?? ctx.request.body ?? {};
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

      const origin = getPublicOrigin(ctx);
      const entity = await es.update('api::article.article', id, {
        data: { workflowStatus: 'rejected', workflowNote: reason || null },
        populate: articlePopulate,
      });
      if (!entity) { ctx.notFound('Article not found'); return; }
      return normalizeArticle(entity, origin);
    },

    async unpublish(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) { ctx.badRequest('Invalid id'); return; }

      const origin = getPublicOrigin(ctx);
      const docService = (strapi as any).documents('api::article.article');

      // Resolve documentId
      let documentId: string | undefined;
      const numericId = parseNumber(id);
      if (numericId) {
        const found = await es.findOne('api::article.article', numericId, {
          fields: ['id', 'documentId'],
          publicationState: 'preview',
        });
        if (!found) { ctx.notFound('Article not found'); return; }
        documentId = parseString((found as any)?.documentId) || id;
      } else {
        documentId = id;
      }

      strapi.log.info(JSON.stringify({
        type: 'unpublish_attempt',
        documentId,
        timestamp: new Date().toISOString(),
      }));

      // Unpublish via Document Service (Strapi v5 canonical API)
      await docService.unpublish({ documentId });

      strapi.log.info(JSON.stringify({
        type: 'unpublish_success',
        documentId,
        timestamp: new Date().toISOString(),
      }));

      // Batch-recalc all tag counts (non-blocking) after unpublish
      void batchRecalcAllTagCounts(strapi);

      // Return the draft version
      const entity = await docService.findOne({ documentId, status: 'draft', populate: articlePopulate });
      return normalizeArticle(entity, origin);
    },

    async delete(ctx) {
      const id = ctx.params.id;
      await es.delete('api::article.article', id);
      // Invalidate Redis cache so deleted article is no longer served
      void invalidateArticleCache(redisCacheConfig, id);
      // Batch-recalc all tag counts (non-blocking) after delete
      void batchRecalcAllTagCounts(strapi);
      ctx.status = 204;
    },
  };
});
