import { factories } from '@strapi/strapi';

const MAX_LIMIT = 100;
const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';

const EDITORIAL_TYPES = [
  'editorial',
  'opinion',
  'review',
  'interview',
  'special-report',
] as const;

type EditorialType = (typeof EDITORIAL_TYPES)[number];

// ─── Utility helpers ────────────────────────────────────────────────────────

const toAbsoluteUrl = (origin: string, url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');

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

const parseDateToISO = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return undefined;
};

const stripHtmlToText = (value: string) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncateText = (value: string, maxLength: number) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
};

const buildSeoTitle = (title: string, editorialType: string) => {
  const rawTitle = String(title || '').trim();
  const baseTitle = rawTitle || 'रामपुर न्यूज़';
  const brand = 'Rampur News';
  const hasBrand =
    baseTitle.toLowerCase().includes(brand.toLowerCase()) ||
    baseTitle.includes('रामपुर न्यूज़');
  const typeLabel =
    editorialType === 'opinion'
      ? 'विचार'
      : editorialType === 'review'
        ? 'रिव्यू'
        : editorialType === 'interview'
          ? 'इंटरव्यू'
          : editorialType === 'special-report'
            ? 'स्पेशल रिपोर्ट'
            : 'संपादकीय';
  const core = `${baseTitle} | ${typeLabel}`;
  const withBrand = hasBrand ? core : `${core} | ${brand}`;
  if (withBrand.length <= 60) return withBrand;
  const baseWithBrand = hasBrand ? baseTitle : `${baseTitle} | ${brand}`;
  if (baseWithBrand.length <= 60) return baseWithBrand;
  return truncateText(baseWithBrand, 60);
};

const buildSeoDescription = (excerpt: string, content: string) => {
  const fromExcerpt = String(excerpt || '').trim();
  if (fromExcerpt) return truncateText(fromExcerpt, 160);
  const cleaned = stripHtmlToText(content || '');
  if (!cleaned) return 'रामपुर न्यूज़ पर संपादकीय और विशेष लेख पढ़ें।';
  return truncateText(cleaned, 160);
};

const buildCanonicalUrl = (slug: string) => {
  const s = String(slug || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!s) return '';
  return `${SITE_URL}/editorials/${s}`;
};

// ─── Populate config ─────────────────────────────────────────────────────────

// NOTE: Strapi v5 entityService (v4 compat layer) does NOT support nested pagination or sort
// inside populate. Using nested pagination/sort causes:
//   ValidationError: Invalid key pagination/sort at articles
// Related articles are limited via a post-processing slice; ordering is done in-memory.
// `filters` inside populate IS supported and is used to restrict to published articles only.
const editorialPopulate: any = {
  image: true,
  author: { populate: { avatar: true } },
  articles: {
    filters: { publishedAt: { $notNull: true } },
    populate: { image: true, category: true, author: true },
  },
};

/** Maximum number of related articles to include in a normalized editorial response */
const MAX_RELATED_ARTICLES = 5;

// ─── Auto read-time calculator ────────────────────────────────────────────────

/** Estimate reading time from HTML/rich-text content (avg 200 words/min Hindi reading speed) */
const calcReadTime = (content: string): string => {
  if (!content) return '2 मिनट';
  const text = String(content)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = text.split(' ').filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} मिनट`;
};

// ─── Google News schema builder ───────────────────────────────────────────────

const buildEditorialSchema = (input: {
  canonicalUrl: string;
  title: string;
  description: string;
  imageUrl: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string;
  editorialType: string;
  keywords: string;
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonicalUrl },
  headline: input.title,
  description: input.description,
  image: input.imageUrl
    ? { '@type': 'ImageObject', url: input.imageUrl, width: 1200, height: 630 }
    : undefined,
  datePublished: input.publishedAt || undefined,
  dateModified: input.modifiedAt || input.publishedAt || undefined,
  author: input.authorName ? [{ '@type': 'Person', name: input.authorName }] : undefined,
  publisher: {
    '@type': 'Organization',
    name: 'रामपुर न्यूज़ | Rampur News',
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 768, height: 768 },
  },
  articleSection: input.editorialType,
  inLanguage: 'hi-IN',
  isAccessibleForFree: true,
  keywords: input.keywords || undefined,
});

// ─── Auto news-keywords builder ───────────────────────────────────────────────

const buildEditorialKeywords = (editorialType: string, authorName: string): string => {
  const typeLabel =
    editorialType === 'opinion'
      ? 'विचार, Opinion'
      : editorialType === 'review'
        ? 'रिव्यू, Review'
        : editorialType === 'interview'
          ? 'इंटरव्यू, Interview'
          : editorialType === 'special-report'
            ? 'स्पेशल रिपोर्ट, Special Report'
            : 'संपादकीय, Editorial';
  const base = [
    typeLabel,
    'रामपुर',
    'Rampur',
    'Rampur News',
    'रामपुर न्यूज़',
    'उत्तर प्रदेश',
    'Uttar Pradesh',
    'Hindi News',
  ];
  if (authorName) base.unshift(authorName);
  const seen = new Set<string>();
  return base
    .flatMap((k) => k.split(',').map((s) => s.trim()))
    .filter((k) => {
      if (!k) return false;
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .join(', ');
};

// ─── Normalizer ──────────────────────────────────────────────────────────────

const normalizeEditorial = (entity: any, origin: string) => {
  if (!entity) return null;

  const imageUrl = entity?.image?.url ? toAbsoluteUrl(origin, entity.image.url) : '';
  const publishedAt = entity?.publishedAt
    ? String(entity.publishedAt)
    : entity?.published_at
      ? String(entity.published_at)
      : '';
  const scheduledAt = entity?.scheduledAt
    ? String(entity.scheduledAt)
    : entity?.scheduled_at
      ? String(entity.scheduled_at)
      : '';
  const status: 'draft' | 'published' | 'scheduled' = publishedAt
    ? 'published'
    : scheduledAt
      ? 'scheduled'
      : 'draft';

  const authorId =
    entity?.author && entity.author.id !== undefined && entity.author.id !== null
      ? String(entity.author.id)
      : undefined;
  const authorSlug =
    entity?.author && entity.author.slug ? String(entity.author.slug) : undefined;
  const authorAvatarUrl = entity?.author?.avatar?.url
    ? toAbsoluteUrl(origin, entity.author.avatar.url)
    : undefined;

  // Normalize related articles — sort in-memory and slice to MAX_RELATED_ARTICLES since
  // nested sort/pagination are not supported in Strapi v5 entityService (v4 compat) populate.
  const relatedArticles = Array.isArray(entity?.articles)
    ? (entity.articles as any[])
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const aTime = a?.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const bTime = b?.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return bTime - aTime; // descending
        })
        .slice(0, MAX_RELATED_ARTICLES)
        .map((a: any) => ({
          id: String(a.id),
          title: a?.title ? String(a.title) : '',
          titleHindi: a?.titleHindi ? String(a.titleHindi) : undefined,
          slug: a?.slug ? String(a.slug) : '',
          image: a?.image?.url ? toAbsoluteUrl(origin, a.image.url) : '/placeholder.svg',
          category: a?.category?.slug ? String(a.category.slug) : '',
          categoryHindi: a?.category?.titleHindi ? String(a.category.titleHindi) : '',
          publishedDate: a?.publishedAt ? String(a.publishedAt) : '',
        }))
    : [];

  const editorialType: EditorialType =
    entity?.editorialType &&
    (EDITORIAL_TYPES as readonly string[]).includes(String(entity.editorialType))
      ? (String(entity.editorialType) as EditorialType)
      : 'editorial';

  const title = entity?.title ? String(entity.title) : '';
  const titleHindi = entity?.titleHindi ? String(entity.titleHindi) : undefined;
  const excerpt = entity?.excerpt ? String(entity.excerpt) : '';
  const content = entity?.content ? String(entity.content) : '';
  const slug = entity?.slug ? String(entity.slug) : '';

  const authorName = entity?.author?.name
    ? String(entity.author.name)
    : entity?.author?.nameHindi
      ? String(entity.author.nameHindi)
      : '';

  // SEO auto-generation
  const seoTitle =
    entity?.seoOverride && entity?.seoTitle
      ? String(entity.seoTitle)
      : buildSeoTitle(title, editorialType);
  const seoDescription =
    entity?.seoOverride && entity?.seoDescription
      ? String(entity.seoDescription)
      : buildSeoDescription(excerpt, content);
  const canonicalUrl = entity?.canonicalUrl
    ? String(entity.canonicalUrl)
    : buildCanonicalUrl(slug);

  // Auto-calculate read time if not set (avg 200 words/min for Hindi)
  const readTime = entity?.readTime
    ? String(entity.readTime)
    : calcReadTime(entity?.contentHindi || content);

  // Auto-generate news keywords if not set
  const newsKeywords = entity?.newsKeywords
    ? String(entity.newsKeywords)
    : buildEditorialKeywords(editorialType, authorName);

  // Auto-generate schema.org JSON-LD if not overridden by editor
  const schemaJson =
    entity?.schemaJson ??
    buildEditorialSchema({
      canonicalUrl,
      title: titleHindi || title,
      description: seoDescription,
      imageUrl: imageUrl,
      publishedAt: publishedAt,
      modifiedAt: entity?.updatedAt ? String(entity.updatedAt) : publishedAt,
      authorName,
      editorialType,
      keywords: newsKeywords,
    });

  return {
    id: String(entity.id),
    title,
    titleHindi,
    slug,
    excerpt,
    excerptHindi: entity?.excerptHindi ? String(entity.excerptHindi) : undefined,
    content,
    contentHindi: entity?.contentHindi ? String(entity.contentHindi) : undefined,
    image: imageUrl || '/placeholder.svg',
    editorialType,
    author: authorName,
    authorId,
    authorSlug,
    authorAvatar: authorAvatarUrl,
    authorRole:
      entity?.author && typeof (entity.author as any)?.role === 'string'
        ? String((entity.author as any).role)
        : undefined,
    publishedDate:
      publishedAt || (entity?.createdAt ? String(entity.createdAt) : new Date().toISOString()),
    publishedAt: publishedAt || undefined,
    modifiedDate: entity?.updatedAt ? String(entity.updatedAt) : undefined,
    readTime,
    isFeatured: Boolean(entity?.isFeatured),
    isEditorsPick: Boolean(entity?.isEditorsPick),
    views: typeof entity?.views === 'number' ? entity.views : undefined,
    status,
    scheduledAt: scheduledAt || undefined,
    seoTitle,
    seoDescription,
    seoOverride: typeof entity?.seoOverride === 'boolean' ? entity.seoOverride : undefined,
    canonicalUrl,
    newsKeywords,
    schemaJson,
    relatedArticles: relatedArticles.length > 0 ? relatedArticles : undefined,
  };
};

// ─── Controller ──────────────────────────────────────────────────────────────

export default factories.createCoreController('api::editorial.editorial', ({ strapi }) => {
  const es = strapi.entityService as any;

  const getPublicOrigin = (ctx: any): string => {
    const fromEnv =
      typeof process.env.STRAPI_PUBLIC_URL === 'string'
        ? process.env.STRAPI_PUBLIC_URL.trim()
        : '';
    if (fromEnv) return fromEnv.replace(/\/+$/, '');

    const headerHost =
      typeof ctx?.request?.header?.host === 'string' ? String(ctx.request.header.host) : '';
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
    if (forwardedHostWithPort && /:1337\b/.test(forwardedHostWithPort)) {
      return `${proto}://${forwardedHostWithPort}`.replace(/\/+$/, '');
    }

    const configuredHost =
      (strapi.config.get('server.host') as string | undefined) || '127.0.0.1';
    const configuredPort =
      (strapi.config.get('server.port') as number | undefined) || 1337;
    const host = configuredHost === '0.0.0.0' ? '127.0.0.1' : configuredHost;
    return `${proto}://${host}:${configuredPort}`;
  };

  const extractData = (body: any) => {
    if (body?.data && typeof body.data === 'object') return body.data;
    return body ?? {};
  };

  const ensureUniqueSlug = async (base: string, excludeId?: number): Promise<string> => {
    const root = slugify(base) || `editorial-${Date.now()}`;
    let candidate = root;
    let attempt = 1;

    while (attempt < 50) {
      const found = await es.findMany('api::editorial.editorial', {
        filters: { slug: candidate },
        limit: 1,
        publicationState: 'preview',
      });

      const existing = Array.isArray(found) ? found[0] : null;
      if (!existing?.id) return candidate;
      if (excludeId && Number(existing.id) === excludeId) return candidate;

      attempt += 1;
      candidate = `${root}-${attempt}`;
    }

    return `${root}-${Date.now()}`;
  };

  const parseRelationId = (value: unknown): number | undefined => {
    const raw = typeof value === 'string' ? value.trim() : value;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
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
      data: { name: raw, nameHindi: raw, email, role: 'author' },
    });
    return created?.id ? Number(created.id) : undefined;
  };

  const resolveArticleIds = async (value: unknown): Promise<number[] | undefined> => {
    if (!Array.isArray(value)) return undefined;
    const ids: number[] = [];
    for (const item of value as any[]) {
      const id = parseRelationId(item?.id ?? item);
      if (id) ids.push(id);
    }
    return ids.length > 0 ? ids : undefined;
  };

  const buildEditorialData = async (input: any, isPartial: boolean) => {
    const data: Record<string, any> = {};

    const set = (key: string, val: any) => {
      if (val !== undefined) data[key] = val;
    };

    if (!isPartial || 'title' in input) set('title', parseString(input.title));
    if (!isPartial || 'titleHindi' in input) set('titleHindi', parseString(input.titleHindi));
    if (!isPartial || 'slug' in input) set('slug', parseString(input.slug));
    if (!isPartial || 'excerpt' in input) set('excerpt', parseString(input.excerpt));
    if (!isPartial || 'excerptHindi' in input) set('excerptHindi', parseString(input.excerptHindi));
    if (!isPartial || 'content' in input) set('content', parseString(input.content));
    if (!isPartial || 'contentHindi' in input) set('contentHindi', parseString(input.contentHindi));
    if (!isPartial || 'readTime' in input) set('readTime', parseString(input.readTime));
    if (!isPartial || 'seoTitle' in input) set('seoTitle', parseString(input.seoTitle));
    if (!isPartial || 'seoDescription' in input)
      set('seoDescription', parseString(input.seoDescription));
    if (!isPartial || 'seoOverride' in input) set('seoOverride', parseBoolean(input.seoOverride));
    if (!isPartial || 'canonicalUrl' in input) set('canonicalUrl', parseString(input.canonicalUrl));
    if (!isPartial || 'newsKeywords' in input)
      set('newsKeywords', parseString(input.newsKeywords));
    if (!isPartial || 'schemaJson' in input) {
      const sc = input.schemaJson;
      if (sc && (typeof sc === 'object' || Array.isArray(sc))) set('schemaJson', sc);
    }
    if (!isPartial || 'isFeatured' in input) set('isFeatured', parseBoolean(input.isFeatured));
    if (!isPartial || 'isEditorsPick' in input)
      set('isEditorsPick', parseBoolean(input.isEditorsPick));
    if (!isPartial || 'views' in input) set('views', parseNumber(input.views));
    if (!isPartial || 'scheduledAt' in input) set('scheduledAt', parseDateToISO(input.scheduledAt));

    if (!isPartial || 'editorialType' in input) {
      const et = parseString(input.editorialType);
      if (et && (EDITORIAL_TYPES as readonly string[]).includes(et)) {
        set('editorialType', et);
      } else if (!isPartial) {
        set('editorialType', 'editorial');
      }
    }

    if (!isPartial || 'author' in input) {
      const authorId = await resolveAuthorId(input.author);
      if (!authorId && !isPartial) throw new Error('AUTHOR_REQUIRED');
      if (authorId) set('author', authorId);
    }

    if (!isPartial || 'articles' in input) {
      const articleIds = await resolveArticleIds(input.articles);
      if (articleIds) set('articles', articleIds);
    }

    return data;
  };

  // ─── Public: find ──────────────────────────────────────────────────────────

  return {
    async find(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const q = ctx.query || {};

      const limit = parseLimit(q.limit ?? q['pagination[pageSize]'], 20);
      const offset = parseNumber(q.offset ?? q['pagination[start]']) ?? 0;
      const page = parseNumber(q['pagination[page]']);
      const computedOffset = page && page > 1 ? (page - 1) * limit : offset;

      const sortParam = parseString(q.sort) ?? 'publishedAt:desc';
      const [sortField, sortDir] = sortParam.split(':');
      const orderBy: Record<string, string> = {};
      const fieldMap: Record<string, string> = {
        publishedAt: 'publishedAt',
        publishedDate: 'publishedAt',
        views: 'views',
        title: 'title',
        heroPriority: 'heroPriority',
      };
      const mappedField = fieldMap[sortField] ?? 'publishedAt';
      orderBy[mappedField] = (sortDir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

      const filters: Record<string, any> = {};

      // editorialType filter — supports both ?editorialType=opinion and
      // Strapi v4 style ?filters[editorialType][$eq]=opinion
      const etDirect = parseString(q.editorialType);
      const etFilter = parseString(
        q['filters[editorialType][$eq]'] ?? q['filters[editorialType][$in]'],
      );
      const etValue = etDirect ?? etFilter;
      if (etValue && (EDITORIAL_TYPES as readonly string[]).includes(etValue)) {
        filters.editorialType = etValue;
      }

      const isEditorsPick = parseBoolean(q.isEditorsPick ?? q['filters[isEditorsPick][$eq]']);
      if (isEditorsPick !== undefined) filters.isEditorsPick = isEditorsPick;

      const isFeatured = parseBoolean(q.isFeatured ?? q['filters[isFeatured][$eq]']);
      if (isFeatured !== undefined) filters.isFeatured = isFeatured;

      const search = parseString(q.search ?? q['filters[$or][0][title][$containsi]']);
      if (search) {
        filters.$or = [
          { title: { $containsi: search } },
          { titleHindi: { $containsi: search } },
          { excerpt: { $containsi: search } },
        ];
      }

      const [entities, total] = await Promise.all([
        es.findMany('api::editorial.editorial', {
          filters,
          populate: editorialPopulate,
          limit,
          start: computedOffset,
          orderBy,
          publicationState: 'live',
        }),
        es.count('api::editorial.editorial', {
          filters,
          publicationState: 'live',
        }),
      ]);

      const data = (Array.isArray(entities) ? entities : [])
        .map((e: any) => normalizeEditorial(e, origin))
        .filter(Boolean);

      ctx.body = {
        data,
        meta: {
          pagination: {
            page: page ?? Math.floor(computedOffset / limit) + 1,
            pageSize: limit,
            pageCount: Math.ceil(total / limit),
            total,
          },
        },
      };
    },

    // ─── Public: findOne ────────────────────────────────────────────────────

    async findOne(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const { id } = ctx.params;

      const entity = await es.findOne('api::editorial.editorial', id, {
        populate: editorialPopulate,
        publicationState: 'live',
      });

      if (!entity) {
        return ctx.notFound('Editorial not found');
      }

      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Public: findBySlug ─────────────────────────────────────────────────

    async findBySlug(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const { slug } = ctx.params;

      const found = await es.findMany('api::editorial.editorial', {
        filters: { slug: decodeURIComponent(slug) },
        populate: editorialPopulate,
        limit: 1,
        publicationState: 'live',
      });

      const entity = Array.isArray(found) ? found[0] : null;
      if (!entity) {
        return ctx.notFound('Editorial not found');
      }

      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Admin: adminFind ───────────────────────────────────────────────────

    async adminFind(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const q = ctx.query || {};

      const limit = parseLimit(q.limit, 20);
      const offset = parseNumber(q.offset) ?? 0;
      const sortParam = parseString(q.sort) ?? 'publishedAt:desc';
      const [sortField, sortDir] = sortParam.split(':');
      const orderBy: Record<string, string> = {};
      orderBy[sortField ?? 'publishedAt'] =
        (sortDir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

      const filters: Record<string, any> = {};
      const etValue = parseString(q.editorialType);
      if (etValue && (EDITORIAL_TYPES as readonly string[]).includes(etValue)) {
        filters.editorialType = etValue;
      }

      const [entities, total] = await Promise.all([
        es.findMany('api::editorial.editorial', {
          filters,
          populate: editorialPopulate,
          limit,
          start: offset,
          orderBy,
          publicationState: 'preview',
        }),
        es.count('api::editorial.editorial', {
          filters,
          publicationState: 'preview',
        }),
      ]);

      const data = (Array.isArray(entities) ? entities : [])
        .map((e: any) => normalizeEditorial(e, origin))
        .filter(Boolean);

      ctx.body = {
        data,
        meta: { pagination: { page: 1, pageSize: limit, pageCount: Math.ceil(total / limit), total } },
      };
    },

    // ─── Admin: adminFindOne ────────────────────────────────────────────────

    async adminFindOne(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const { id } = ctx.params;

      const entity = await es.findOne('api::editorial.editorial', id, {
        populate: editorialPopulate,
        publicationState: 'preview',
      });

      if (!entity) return ctx.notFound('Editorial not found');
      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Admin: adminFindBySlug ─────────────────────────────────────────────

    async adminFindBySlug(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const { slug } = ctx.params;

      const found = await es.findMany('api::editorial.editorial', {
        filters: { slug: decodeURIComponent(slug) },
        populate: editorialPopulate,
        limit: 1,
        publicationState: 'preview',
      });

      const entity = Array.isArray(found) ? found[0] : null;
      if (!entity) return ctx.notFound('Editorial not found');
      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Create ─────────────────────────────────────────────────────────────

    async create(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const input = extractData(ctx.request.body);

      if (!parseString(input.title)) {
        return ctx.badRequest('Title is required');
      }
      if (!parseString(input.excerpt)) {
        return ctx.badRequest('Excerpt is required');
      }
      if (!parseString(input.content)) {
        return ctx.badRequest('Content is required');
      }

      let data: Record<string, any>;
      try {
        data = await buildEditorialData(input, false);
      } catch (err: any) {
        if (err?.message === 'AUTHOR_REQUIRED') {
          return ctx.badRequest('Author is required');
        }
        throw err;
      }

      // Auto-generate slug if not provided
      if (!data.slug) {
        data.slug = await ensureUniqueSlug(String(input.title || ''));
      }

      const entity = await es.create('api::editorial.editorial', {
        data,
        populate: editorialPopulate,
      });

      ctx.status = 201;
      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Update ─────────────────────────────────────────────────────────────

    async update(ctx: any) {
      const origin = getPublicOrigin(ctx);
      const { id } = ctx.params;
      const input = extractData(ctx.request.body);

      const existing = await es.findOne('api::editorial.editorial', id, {
        publicationState: 'preview',
      });
      if (!existing) return ctx.notFound('Editorial not found');

      const data = await buildEditorialData(input, true);

      const entity = await es.update('api::editorial.editorial', id, {
        data,
        populate: editorialPopulate,
      });

      ctx.body = { data: normalizeEditorial(entity, origin) };
    },

    // ─── Delete ─────────────────────────────────────────────────────────────

    async delete(ctx: any) {
      const { id } = ctx.params;

      const existing = await es.findOne('api::editorial.editorial', id, {
        publicationState: 'preview',
      });
      if (!existing) return ctx.notFound('Editorial not found');

      await es.delete('api::editorial.editorial', id);
      ctx.status = 204;
      ctx.body = null;
    },
  };
});
