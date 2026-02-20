import { factories } from '@strapi/strapi';

const MAX_LIMIT = 100;
const SITE_URL = typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim() ? process.env.SITE_URL.trim().replace(/\/+$/, '') : 'https://rampurnews.com';

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

  return {
    id: String(entity.id),
    title: entity?.title ? String(entity.title) : '',
    slug: entity?.slug ? String(entity.slug) : '',
    excerpt: entity?.excerpt ? String(entity.excerpt) : '',
    content: entity?.content ? String(entity.content) : '',
    image: imageUrl || '/placeholder.svg',
    featuredMediaId: entity?.image?.id ? String(entity.image.id) : undefined,
    category: entity?.category?.slug ? String(entity.category.slug) : '',
    categoryHindi: entity?.category?.titleHindi ? String(entity.category.titleHindi) : '',
    author: entity?.author?.name ? String(entity.author.name) : entity?.author?.nameHindi ? String(entity.author.nameHindi) : '',
    authorId,
    authorSlug,
    publishedDate: publishedAt || (entity?.createdAt ? String(entity.createdAt) : new Date().toISOString()),
    publishedAt: publishedAt || undefined,
    modifiedDate: entity?.updatedAt ? String(entity.updatedAt) : undefined,
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
    seoTitle: entity?.seoTitle ? String(entity.seoTitle) : undefined,
    seoDescription: entity?.seoDescription ? String(entity.seoDescription) : undefined,
    seoOverride: typeof entity?.seoOverride === 'boolean' ? entity.seoOverride : undefined,
    canonicalUrl: entity?.canonicalUrl ? String(entity.canonicalUrl) : undefined,
    newsKeywords: entity?.newsKeywords ? String(entity.newsKeywords) : undefined,
    schemaJson: entity?.schemaJson ?? undefined,
    videoUrl: entity?.videoUrl ? String(entity.videoUrl) : undefined,
    videoType: entity?.videoType ? String(entity.videoType) : undefined,
    videoTitle: entity?.videoTitle ? String(entity.videoTitle) : undefined,
    scheduledAt: scheduledAt || undefined,
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
  if (withBrand.length <= 60) return withBrand;

  const compactCore = category ? `${baseTitle} | ${category}` : baseTitle;
  if (compactCore.length <= 60) return truncateText(compactCore, 60);

  const baseWithBrand = hasBrand ? baseTitle : `${baseTitle} | ${brand}`;
  if (baseWithBrand.length <= 60) return baseWithBrand;

  return truncateText(baseWithBrand, 60);
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
        url: `${SITE_URL}/logo.png`,
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
  image: true,
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
    if (forwardedHostWithPort && /:1337\b/.test(forwardedHostWithPort)) {
      return `${proto}://${forwardedHostWithPort}`.replace(/\/+$/, '');
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
    if (!isPartial || 'titleHindi' in input) set('titleHindi', parseString(input.titleHindi) ?? input.titleHindi ?? undefined);
    if (!isPartial || 'slug' in input) set('slug', parseString(input.slug) ?? input.slug ?? undefined);
    if (!isPartial || 'excerpt' in input) set('excerpt', parseString(input.excerpt) ?? input.excerpt ?? undefined);
    if (!isPartial || 'excerptHindi' in input) set('excerptHindi', parseString(input.excerptHindi) ?? input.excerptHindi ?? undefined);
    if (!isPartial || 'content' in input) set('content', parseString(input.content) ?? input.content ?? undefined);
    if (!isPartial || 'contentHindi' in input) set('contentHindi', parseString(input.contentHindi) ?? input.contentHindi ?? undefined);
    if (!isPartial || 'readTime' in input) set('readTime', parseString(input.readTime) ?? input.readTime ?? undefined);
    if (!isPartial || 'videoUrl' in input) set('videoUrl', parseString(input.videoUrl) ?? input.videoUrl ?? undefined);
    if (!isPartial || 'videoType' in input) set('videoType', parseString(input.videoType) ?? input.videoType ?? undefined);
    if (!isPartial || 'videoTitle' in input) set('videoTitle', parseString(input.videoTitle) ?? input.videoTitle ?? undefined);
    if (!isPartial || 'seoTitle' in input) set('seoTitle', parseString(input.seoTitle) ?? input.seoTitle ?? undefined);
    if (!isPartial || 'seoDescription' in input) set('seoDescription', parseString(input.seoDescription) ?? input.seoDescription ?? undefined);
    if (!isPartial || 'seoOverride' in input) set('seoOverride', parseBoolean(input.seoOverride) ?? false);
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

    if (!isPartial || 'scheduledAt' in input) set('scheduledAt', parseDateToISO(input.scheduledAt));

    if (!isPartial || 'category' in input) {
      const categoryId = await resolveCategoryId(input.category);
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

    if (!isPartial || 'featuredMediaId' in input || 'image' in input) {
      const featuredMediaIdRaw = input.featuredMediaId;
      const featuredMediaId = parseRelationId(featuredMediaIdRaw);
      const imageUrl = parseString(input.image);

      if (featuredMediaId) {
        set('image', featuredMediaId);
      } else if (featuredMediaIdRaw === null || (featuredMediaIdRaw === '' && !imageUrl)) {
        set('image', null);
      } else if (imageUrl) {
        const fileId = await resolveUploadFileIdByUrl(imageUrl, origin);
        if (fileId) set('image', fileId);
      }
    }

    const status = parseString(input.status);
    const publishedDate = parseDateToISO(input.publishedDate);
    if (status === 'published') {
      set('publishedAt', publishedDate ?? new Date().toISOString());
    } else if (status === 'draft') {
      set('publishedAt', null);
    } else if (status === 'scheduled') {
      set('publishedAt', null);
      if (!data.scheduledAt) {
        const next = parseDateToISO(input.scheduledAt) ?? publishedDate;
        if (next) set('scheduledAt', next);
      }
    } else if (!isPartial && publishedDate) {
      set('publishedAt', publishedDate);
    } else if (isPartial && ('publishedDate' in input) && publishedDate) {
      set('publishedAt', publishedDate);
    }

    if (!isPartial) {
      const slugCandidate = parseString(input.slug);
      if (!slugCandidate) {
        const titleCandidate = parseString(input.title) ?? parseString(input.titleHindi) ?? '';
        data.slug = await ensureUniqueSlug(titleCandidate);
      } else {
        data.slug = await ensureUniqueSlug(slugCandidate);
      }
    }

    const seoOverride = parseBoolean(input.seoOverride) ?? false;
    const wantsSeo = !isPartial || 'seoTitle' in input || 'seoDescription' in input || 'seoOverride' in input || 'canonicalUrl' in input || 'newsKeywords' in input || 'schemaJson' in input || 'title' in input || 'excerpt' in input || 'content' in input || 'category' in input || 'slug' in input || 'tags' in input || 'image' in input || 'featuredMediaId' in input || 'author' in input || 'publishedDate' in input || 'status' in input;
    if (wantsSeo) {
      const title = parseString(input.title) ?? (typeof data.title === 'string' ? data.title : '');
      const excerpt = parseString(input.excerpt) ?? (typeof data.excerpt === 'string' ? data.excerpt : '');
      const content = parseString(input.content) ?? (typeof data.content === 'string' ? data.content : '');

      const categorySlugFromInput = parseString(input.category) || '';
      const categoryId = typeof data.category === 'number' ? data.category : parseRelationId(input.category);
      let categoryEntity: any = null;
      if (categoryId) {
        try {
          categoryEntity = await es.findOne('api::category.category', categoryId, {});
        } catch {
          categoryEntity = null;
        }
      }
      const categorySlug = categorySlugFromInput || (categoryEntity?.slug ? String(categoryEntity.slug) : '');
      const categoryName =
        (categoryEntity?.titleEnglish ? String(categoryEntity.titleEnglish) : '') ||
        (categoryEntity?.titleHindi ? String(categoryEntity.titleHindi) : '') ||
        categorySlug;

      const slug = parseString(input.slug) || (typeof data.slug === 'string' ? data.slug : '');
      const canonicalUrl = buildCanonicalUrl(categorySlug, slug);

      const manualSeoTitle = parseString(input.seoTitle);
      const manualSeoDescription = parseString(input.seoDescription);
      const manualCanonicalUrl = parseString(input.canonicalUrl);
      const manualNewsKeywords = parseString(input.newsKeywords);
      const manualSchemaJson = input.schemaJson && (typeof input.schemaJson === 'object' || Array.isArray(input.schemaJson)) ? input.schemaJson : undefined;

      const imageCandidate = parseString(input.image) || '';
      const featuredImageUrl = imageCandidate ? toAbsoluteUrl(origin, imageCandidate) : '';

      const publishedDate = parseDateToISO(input.publishedDate) || '';
      const modifiedAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';

      const authorRaw = parseString(input.author) || '';
      const authorId = parseRelationId(input.author);
      let authorEntity: any = null;
      if (authorId) {
        try {
          authorEntity = await es.findOne('api::author.author', authorId, {});
        } catch {
          authorEntity = null;
        }
      }
      const authorName = authorEntity?.nameHindi ? String(authorEntity.nameHindi) : authorEntity?.name ? String(authorEntity.name) : authorRaw;

      const tagsInput = Array.isArray(input.tags) ? (input.tags as any[]).map((t) => String(t || '').trim()).filter(Boolean) : undefined;
      const newsKeywords = buildNewsKeywords(categoryName, tagsInput);

      const autoSeoTitle = buildSeoTitle(title, categoryName);
      const autoSeoDescription = buildSeoDescription(excerpt, content);

      const schemaAuto =
        canonicalUrl && title
          ? buildNewsArticleSchema({
              canonicalUrl,
              title: autoSeoTitle,
              description: autoSeoDescription,
              imageUrl: featuredImageUrl,
              publishedAt: publishedDate,
              modifiedAt,
              authorName,
              section: categoryName,
              keywords: newsKeywords,
            })
          : undefined;

      if (!seoOverride) {
        set('seoOverride', false);
        set('seoTitle', autoSeoTitle);
        set('seoDescription', autoSeoDescription);
        if (canonicalUrl) set('canonicalUrl', canonicalUrl);
        if (newsKeywords) set('newsKeywords', newsKeywords);
        if (schemaAuto) set('schemaJson', schemaAuto);
      } else {
        set('seoOverride', true);
        set('seoTitle', manualSeoTitle || autoSeoTitle);
        set('seoDescription', manualSeoDescription || autoSeoDescription);
        if (manualCanonicalUrl || canonicalUrl) set('canonicalUrl', manualCanonicalUrl || canonicalUrl);
        if (manualNewsKeywords || newsKeywords) set('newsKeywords', manualNewsKeywords || newsKeywords);
        if (manualSchemaJson || schemaAuto) set('schemaJson', manualSchemaJson || schemaAuto);
      }
    }

    return data;
  };

  return ({
  async featured(ctx) {
    const limit = parseLimit(ctx.query.limit, 10);
    const origin = ctx.request.origin || '';
    const entities = await es.findMany('api::article.article', {
      filters: { isFeatured: true },
      sort: { publishedAt: 'desc' },
      populate: articlePopulate,
      publicationState: 'live',
      limit,
    });
    return (entities as any[]).map((e) => normalizeArticle(e, origin));
  },

  async breaking(ctx) {
    const limit = parseLimit(ctx.query.limit, 10);
    const origin = ctx.request.origin || '';
    const entities = await es.findMany('api::article.article', {
      filters: { isBreaking: true },
      sort: { publishedAt: 'desc' },
      populate: articlePopulate,
      publicationState: 'live',
      limit,
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
          publishedAt: { $notNull: true },
        },
        sort: { publishedAt: 'desc' },
        populate: articlePopulate,
        publicationState: 'live',
        limit: featuredLimit,
      }),
      es.findMany('api::article.article', {
        filters: {
          isBreaking: true,
          publishedAt: { $notNull: true },
        },
        sort: { publishedAt: 'desc' },
        populate: articlePopulate,
        publicationState: 'live',
        limit: limit * 2,
      }),
    ]);

    const featuredList = Array.isArray(featuredEntities) ? featuredEntities : [];
    const featuredIds = new Set((featuredList as any[]).map((e) => e.id));

    const breakingListRaw = Array.isArray(breakingCandidates) ? (breakingCandidates as any[]) : [];
    const breakingList = breakingListRaw.filter((e) => !featuredIds.has(e.id)).slice(0, breakingLimit);

    let combined = [...featuredList, ...breakingList];

    if (combined.length === 0) {
      combined = await es.findMany('api::article.article', {
        filters: { publishedAt: { $notNull: true } },
        sort: { publishedAt: 'desc' },
        populate: articlePopulate,
        publicationState: 'live',
        limit,
      });
    }

    return (combined as any[]).map((e) => normalizeArticle(e, origin));
  },

  async trending(ctx) {
    const limit = parseLimit(ctx.query.limit, 10);
    const origin = ctx.request.origin || '';
    const entities = await es.findMany('api::article.article', {
      sort: { views: 'desc' },
      populate: articlePopulate,
      publicationState: 'live',
      limit,
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
      $or: [{ category: { slug: categorySlug } }, { categories: { slug: categorySlug } }],
    };

    const [entities, total] = await Promise.all([
      es.findMany('api::article.article', {
        filters,
        sort: { publishedAt: 'desc' },
        populate: articlePopulate,
        publicationState: 'live',
        start: offset,
        limit,
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
        { titleHindi: { $containsi: q } },
        { excerpt: { $containsi: q } },
        { excerptHindi: { $containsi: q } },
        { content: { $containsi: q } },
        { contentHindi: { $containsi: q } },
      ],
    };

    const [entities, total] = await Promise.all([
      es.findMany('api::article.article', {
        filters,
        sort: { publishedAt: 'desc' },
        populate: articlePopulate,
        publicationState: 'live',
        start: offset,
        limit,
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
    const status = parseString(ctx.query.status);
    const featured = parseBoolean(ctx.query.featured);
    const breaking = parseBoolean(ctx.query.breaking);
    const search = parseString(ctx.query.search);
    const author = parseString(ctx.query.author);
    const orderBy = parseString(ctx.query.orderBy) ?? 'publishedAt';
    const order = (parseString(ctx.query.order) ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const origin = ctx.request.origin || '';

    const filters: Record<string, any> = {};
    if (category) {
      filters.$and = filters.$and || [];
      filters.$and.push({
        $or: [{ category: { slug: category } }, { categories: { slug: category } }],
      });
    }
    if (featured !== undefined) filters.isFeatured = featured;
    if (breaking !== undefined) filters.isBreaking = breaking;

    if (author) {
      filters.author = author.includes('@') ? { email: author } : { $or: [{ name: author }, { nameHindi: author }] };
    }

    if (search) {
      filters.$or = [
        { title: { $containsi: search } },
        { titleHindi: { $containsi: search } },
        { excerpt: { $containsi: search } },
        { excerptHindi: { $containsi: search } },
        { content: { $containsi: search } },
        { contentHindi: { $containsi: search } },
      ];
    }

    if (status === 'published') {
      filters.publishedAt = { $notNull: true };
    } else if (status === 'draft') {
      filters.publishedAt = { $null: true };
    } else if (status === 'scheduled') {
      filters.publishedAt = { $null: true };
      filters.scheduledAt = { $notNull: true };
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
    const category = parseString(ctx.query.category);
    const featured = parseBoolean(ctx.query.featured);
    const breaking = parseBoolean(ctx.query.breaking);
    const search = parseString(ctx.query.search);
    const author = parseString(ctx.query.author);
    const orderBy = parseString(ctx.query.orderBy) ?? 'publishedAt';
    const order = (parseString(ctx.query.order) ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const origin = getPublicOrigin(ctx);

    const filters: Record<string, any> = {};
    if (category) {
      filters.$and = filters.$and || [];
      filters.$and.push({
        $or: [{ category: { slug: category } }, { categories: { slug: category } }],
      });
    }
    if (featured !== undefined) filters.isFeatured = featured;
    if (breaking !== undefined) filters.isBreaking = breaking;
    if (author) {
      filters.author = author.includes('@') ? { email: author } : { $or: [{ name: author }, { nameHindi: author }] };
    }
    if (search) {
      filters.$or = [
        { title: { $containsi: search } },
        { titleHindi: { $containsi: search } },
        { excerpt: { $containsi: search } },
        { excerptHindi: { $containsi: search } },
        { content: { $containsi: search } },
        { contentHindi: { $containsi: search } },
      ];
    }

    const sortKeyWhitelist = new Set(['publishedAt', 'publishedDate', 'views', 'title']);
    const sortFieldRaw = sortKeyWhitelist.has(orderBy) ? orderBy : 'publishedAt';
    const sortField = sortFieldRaw === 'publishedDate' ? 'publishedAt' : sortFieldRaw;
    const sort = { [sortField]: order };

    const [entities, total] = await Promise.all([
      es.findMany('api::article.article', {
        filters,
        sort,
        populate: articlePopulate,
        publicationState: 'live',
        start: offset,
        limit,
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

  async delete(ctx) {
    const id = ctx.params.id;
    await es.delete('api::article.article', id);
    ctx.status = 204;
  },
  });
});
