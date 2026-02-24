import { factories } from '@strapi/strapi';

const MAX_LIMIT = 5000;
const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';
const EDITORIAL_CATEGORY_SLUG = 'editorials';
const EDITORIAL_CONTENT_TYPES = ['editorial', 'review', 'interview', 'opinion', 'special-report'] as const;
const DEFAULT_SORT_FIELD = 'publishedAt';

const resolveSortField = (orderBy: string | undefined) => {
  const sortKeyWhitelist = new Set(['publishedAt', 'createdAt', 'views', 'title']);
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

const normalizeArticle = (entity: any, origin: string) => {
  if (!entity) return null;
  const featuredImageUrl =
    entity?.featured_image?.url || entity?.image?.url
      ? toAbsoluteUrl(origin, entity?.featured_image?.url || entity?.image?.url)
      : '';
  const publishedAt = entity?.publishedAt || entity?.createdAt || '';
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
    content: entity?.content ? String(entity.content) : '',
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
    status,
    tags: tags.length > 0 ? tags : undefined,
    categories: categories.length > 0 ? categories : undefined,
    focus_keyword: entity?.focus_keyword ? String(entity.focus_keyword) : undefined,
    location: entity?.location ? String(entity.location) : undefined,
    news_category: entity?.news_category ? String(entity.news_category) : undefined,
    seoTitle: entity?.seoTitle ? String(entity.seoTitle) : undefined,
    discoverEligible: typeof entity?.discoverEligible === 'boolean' ? entity.discoverEligible : undefined,
    canonicalUrl: entity?.canonicalUrl ? String(entity.canonicalUrl) : undefined,
    newsKeywords: entity?.newsKeywords ? String(entity.newsKeywords) : undefined,
    schemaJson: entity?.schemaJson ?? undefined,
    meta_description: entity?.meta_description ? String(entity.meta_description) : undefined,
    videoUrl: entity?.videoUrl ? String(entity.videoUrl) : undefined,
    videoType: entity?.videoType ? String(entity.videoType) : undefined,
    videoTitle: entity?.videoTitle ? String(entity.videoTitle) : undefined,
    structuredData,
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
    const root = slugify(base) || `article-${Date.now()}`;
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
      candidate = `${root}-${attempt}`;
    }

    return `${root}-${Date.now()}`;
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
    const names = (value as any[])
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
    if (names.length === 0) return [];

    const ids: number[] = [];
    for (const name of names) {
      const existing = await es.findMany('api::tag.tag', { filters: { name }, limit: 1 });
      const match = Array.isArray(existing) ? existing[0] : null;
      if (match?.id) {
        ids.push(Number(match.id));
        continue;
      }
      const created = await es.create('api::tag.tag', { data: { name, nameHindi: name } });
      if (created?.id) ids.push(Number(created.id));
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
      set('short_headline', explicit || truncateText(title, 110) || undefined);
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
    if (!isPartial || 'canonicalUrl' in input) set('canonicalUrl', parseString(input.canonicalUrl) ?? input.canonicalUrl ?? undefined);
    if (!isPartial || 'newsKeywords' in input) set('newsKeywords', parseString(input.newsKeywords) ?? input.newsKeywords ?? undefined);
    if (!isPartial || 'schemaJson' in input) {
      const schemaCandidate = input.schemaJson;
      if (schemaCandidate && (typeof schemaCandidate === 'object' || Array.isArray(schemaCandidate))) {
        set('schemaJson', schemaCandidate);
      }
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
    }

    return data;
  };

  return {
    async featured(ctx) {
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = ctx.request.origin || '';
      const entities = await es.findMany('api::article.article', {
        filters: { 
          isFeatured: true,
        },
        sort: { [DEFAULT_SORT_FIELD]: 'desc' },
        populate: articlePopulate,
        limit,
        publicationState: 'live',
      });
      return (entities as any[]).map((e) => normalizeArticle(e, origin));
    },

    async breaking(ctx) {
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = ctx.request.origin || '';
      const now = Date.now();
      const cutoff = new Date(now - 48 * 60 * 60 * 1000).toISOString();
      const entities = await es.findMany('api::article.article', {
        filters: { 
          isBreaking: true,
          publishedAt: { $gte: cutoff },
        },
        sort: { [DEFAULT_SORT_FIELD]: 'desc' },
        populate: articlePopulate,
        limit,
        publicationState: 'live',
      });
      return (entities as any[]).map((e) => normalizeArticle(e, origin));
    },

    async hero(ctx) {
      const totalLimit = parseLimit(ctx.query.limit, 15);
      const limit = Math.max(1, Math.min(totalLimit, MAX_LIMIT));
      const origin = ctx.request.origin || '';

      const featuredLimit = Math.min(3, limit);
      const breakingLimit = Math.max(0, limit - featuredLimit);

      const [featuredEntities, breakingCandidates] = await Promise.all([
        es.findMany('api::article.article', {
          filters: {
            isFeatured: true,
          },
          sort: { [DEFAULT_SORT_FIELD]: 'desc' },
          populate: articlePopulate,
          limit: featuredLimit,
          publicationState: 'live',
        }),
        es.findMany('api::article.article', {
          filters: {
            isBreaking: true,
          },
          sort: { [DEFAULT_SORT_FIELD]: 'desc' },
          populate: articlePopulate,
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
          sort: { [DEFAULT_SORT_FIELD]: 'desc' },
          populate: articlePopulate,
          limit,
          publicationState: 'live',
        });
      }

      return (combined as any[]).map((e) => normalizeArticle(e, origin));
    },

    async newsSitemap(ctx) {
      const origin = getPublicOrigin(ctx) || SITE_URL;
      const now = new Date();
      const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

      const entities = await es.findMany('api::article.article', {
        filters: {
          publishedAt: { $gte: since },
        },
        sort: { publishedAt: 'desc' },
        limit: 1000,
        populate: { featured_image: true, category: true },
        publicationState: 'live',
      });

      const urls = (entities as any[]).map((entity) => {
        const slug = entity?.slug ? String(entity.slug) : '';
        const categorySlug = entity?.category?.slug ? String(entity.category.slug) : '';
        const loc = `${origin}/${categorySlug}/${slug}`.replace(/\/+/g, '/').replace(':/', '://');
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
          sort: { publishedAt: 'desc' },
          limit: 5000,
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
          const loc = `${origin}/${categorySlug}/${a?.slug || ''}`.replace(/\/+/g, '/').replace(':/', '://');
          const lastmod = formatIso(a?.updatedAt || a?.publishedAt) || now;
          return { loc, lastmod };
        }),
      ].filter((u) => u.loc && !u.loc.includes('/tags') && !u.loc.includes('/tag') && !u.loc.includes('/admin'));

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
      const limit = parseLimit(ctx.query.limit, 10);
      const origin = ctx.request.origin || '';
      const entities = await es.findMany('api::article.article', {
        filters: {},
        sort: { views: 'desc' },
        populate: articlePopulate,
        limit,
        publicationState: 'live',
      });
      return (entities as any[]).map((e) => normalizeArticle(e, origin));
    },

    async byCategory(ctx) {
      const limit = parseLimit(ctx.query.limit, 25);
      const offset = parseNumber(ctx.query.offset) ?? 0;
      const categorySlug = parseString(ctx.params.slug);
      if (!categorySlug) {
        ctx.badRequest('Category slug is required');
        return;
      }
      const origin = ctx.request.origin || '';

      const filters = {
        $or: [
          { category: { slug: categorySlug } },
          { categories: { slug: categorySlug } },
        ],
      };

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          sort: { [DEFAULT_SORT_FIELD]: 'desc' },
          populate: articlePopulate,
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
        data: (entities as any[]).map((e) => normalizeArticle(e, origin)),
        total,
        page,
        pageSize,
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
          sort: { [DEFAULT_SORT_FIELD]: 'desc' },
          populate: articlePopulate,
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
        data: (entities as any[]).map((e) => normalizeArticle(e, origin)),
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
      if (breaking !== undefined) filters.isBreaking = breaking;

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
        filters.publishedAt = { $notNull: true };
      } else if (status === 'draft') {
        filters.publishedAt = { $null: true };
      }

      const sortKeyWhitelist = new Set(['publishedAt', 'publishedDate', 'views', 'title', 'createdAt', 'updatedAt']);
      const sortFieldRaw = sortKeyWhitelist.has(orderBy) ? orderBy : 'publishedAt';
      const sortField = sortFieldRaw === 'publishedDate' ? 'publishedAt' : sortFieldRaw;
      const sort = { [sortField]: order };

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          sort,
          populate: articlePopulate,
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
        data: (entities as any[]).map((e) => normalizeArticle(e, origin)),
        total,
        page,
        pageSize,
        totalPages,
      };
    },

    async find(ctx) {
      const limit = parseLimit(ctx.query.limit, 25);
      const offset = parseNumber(ctx.query.offset) ?? 0;
      const origin = getPublicOrigin(ctx);

      const filters: Record<string, any> = ctx.query.filters 
        ? JSON.parse(JSON.stringify(ctx.query.filters)) 
        : {};

      const category = parseString(ctx.query.category);
      const parent = parseString(ctx.query.parent);
      const featured = parseBoolean(ctx.query.featured);
      const breaking = parseBoolean(ctx.query.breaking);
      const search = parseString(ctx.query.search);
      const author = parseString(ctx.query.author);

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
      if (breaking !== undefined) filters.isBreaking = breaking;
      if (author) {
        filters.$and = filters.$and || [];
        filters.$and.push({
          author: author.includes('@') ? { email: author } : { $or: [{ name: author }, { nameHindi: author }] },
        });
      }
      if (search) {
        filters.$and = filters.$and || [];
        filters.$and.push({
          $or: [
            { title: { $containsi: search } },
            { excerpt: { $containsi: search } },
            { content: { $containsi: search } },
          ],
        });
      }

      let sort: any = ctx.query.sort;

      if (typeof sort === 'string') {
        const [field, order] = sort.split(':');
        if (field && order) {
          const resolvedField = resolveSortField(field);
          sort = { [resolvedField]: order };
        }
      } else if (Array.isArray(sort)) {
        const normalized = sort
          .filter((entry) => typeof entry === 'string')
          .map((entry) => {
            const [field, order] = String(entry).split(':');
            const resolvedField = resolveSortField(field);
            return order ? `${resolvedField}:${order}` : resolvedField;
          });
        sort = normalized.length > 0 ? normalized : undefined;
      } else if (sort && typeof sort === 'object') {
        if (sort.publishedDate) {
          sort = { ...sort, publishedAt: sort.publishedDate };
          delete sort.publishedDate;
        }
      }

      if (!sort) {
          const orderBy = parseString(ctx.query.orderBy);
          const order = (parseString(ctx.query.order) ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
          
          if (orderBy) {
             sort = { [resolveSortField(orderBy)]: order };
          } else {
             sort = { [DEFAULT_SORT_FIELD]: 'desc' };
          }
      }

      const [entities, total] = await Promise.all([
        es.findMany('api::article.article', {
          filters,
          sort,
          populate: articlePopulate,
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
        data: (entities as any[]).map((e) => normalizeArticle(e, origin)),
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
      const entities = await es.findMany('api::article.article', {
        filters: { slug },
        populate: articlePopulate,
        publicationState: 'live',
        limit: 1,
      });
      const entity = (entities as any[])[0];
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
        const data = await buildStrapiArticleData(input, origin, false);
        const entity = await es.create('api::article.article', {
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
        throw error;
      }
    },

    async update(ctx) {
      const id = ctx.params.id;
      const origin = getPublicOrigin(ctx);
      const input = extractData(ctx.request.body);
      const data = await buildStrapiArticleData(input, origin, true);
      if (typeof data.slug === 'string' && data.slug.trim()) {
        data.slug = await ensureUniqueSlug(data.slug, Number(id));
      }
      const entity = await es.update('api::article.article', id, {
        data,
        populate: articlePopulate,
      });
      return normalizeArticle(entity, origin);
    },

    async publish(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) {
        ctx.badRequest('Invalid id');
        return;
      }

      const origin = getPublicOrigin(ctx);
      const documentId = Number.isFinite(Number(id)) ? Number(id) : id;
      const docsFactory = (strapi as any).documents;
      const docs = typeof docsFactory === 'function' ? docsFactory.call(strapi, 'api::article.article') : null;
      if (docs && typeof docs.publish === 'function') {
        await docs.publish({ documentId });
      } else {
        await es.update('api::article.article', id, { data: { publishedAt: new Date().toISOString() } });
      }
      const entity = await es.findOne('api::article.article', id, {
        populate: articlePopulate,
        publicationState: 'preview',
      });
      return normalizeArticle(entity, origin);
    },

    async unpublish(ctx) {
      const id = String(ctx.params.id || '').trim();
      if (!id) {
        ctx.badRequest('Invalid id');
        return;
      }

      const origin = getPublicOrigin(ctx);
      const documentId = Number.isFinite(Number(id)) ? Number(id) : id;
      const docsFactory = (strapi as any).documents;
      const docs = typeof docsFactory === 'function' ? docsFactory.call(strapi, 'api::article.article') : null;
      if (docs && typeof docs.unpublish === 'function') {
        await docs.unpublish({ documentId });
      } else {
        await es.update('api::article.article', id, { data: { publishedAt: null } });
      }
      const entity = await es.findOne('api::article.article', id, {
        populate: articlePopulate,
        publicationState: 'preview',
      });
      return normalizeArticle(entity, origin);
    },

    async delete(ctx) {
      const id = ctx.params.id;
      await es.delete('api::article.article', id);
      ctx.status = 204;
    },
  };
});
