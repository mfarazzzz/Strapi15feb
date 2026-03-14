const ARTICLE_UID = 'api::article.article';
const UPLOAD_FILE_UID = 'plugin::upload.file';
const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';
const path = require('path');
const { applyInternalLinks } = require(path.join(process.cwd(), 'src/api/article/services/internal-linking.js'));

const CLICKBAIT_PHRASES = [
  'आप चौंक जाएंगे',
  'देखते रह जाएंगे',
  'चौंक जाएंगे',
  'देखते रह जाएंगे',
  'शर्मनाक',
];

const toSlug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const stripHtml = (value) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value, max) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
};

const hasExcessivePunctuation = (value) => {
  const text = String(value || '');
  if ((text.match(/[!?]/g) || []).length > 3) return true;
  if (/([!?])\1{1,}/.test(text)) return true;
  return false;
};

const isAllCaps = (value) => {
  const letters = String(value || '').replace(/[^A-Z]/g, '');
  const total = String(value || '').replace(/[^A-Za-z]/g, '');
  if (!total) return false;
  return letters.length / total.length > 0.8 && total.length >= 6;
};

const containsClickbait = (value) => {
  const text = String(value || '').toLowerCase();
  return CLICKBAIT_PHRASES.some((phrase) => text.includes(phrase));
};

const getRequestUser = (strapi) => {
  try {
    const ctx = strapi.requestContext.get();
    return ctx?.state?.user || null;
  } catch {
    return null;
  }
};

const ensureEditorPublish = (strapi, shouldPublish) => {
  if (!shouldPublish) return;
  const user = getRequestUser(strapi);
  const roleType = user?.role?.type || user?.role?.name || '';
  if (roleType && !['admin', 'editor'].includes(String(roleType))) {
    throw new Error('Only editors can publish articles');
  }
};

const resolveMediaId = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  if (typeof value === 'object') {
    if (typeof value.id === 'number') return value.id;
    if (typeof value.id === 'string') return Number(value.id);
    if (Array.isArray(value.connect) && value.connect[0]?.id) return Number(value.connect[0].id);
  }
  return undefined;
};

const validateFeaturedImage = async (strapi, mediaId) => {
  if (!mediaId) throw new Error('Featured image is required');
  const file = await strapi.entityService.findOne(UPLOAD_FILE_UID, mediaId, {});
  if (!file) throw new Error('Featured image not found');
  const width = typeof file.width === 'number' ? file.width : 0;
  const mime = typeof file.mime === 'string' ? file.mime : '';
  if (mime && mime !== 'image/jpeg' && mime !== 'image/webp') {
    throw new Error('Featured image must be JPEG or WebP');
  }
  if (width < 1200) {
    throw new Error('Featured image must be at least 1200px wide');
  }
};
const resolveDiscoverEligibility = async (strapi, data, existing) => {
  const mediaId =
    resolveMediaId(data.featured_image) ||
    (existing?.featured_image?.id ? Number(existing.featured_image.id) : undefined);
  if (!mediaId) return false;
  const file = await strapi.entityService.findOne(UPLOAD_FILE_UID, mediaId, {});
  const width = typeof file?.width === 'number' ? file.width : 0;
  return width >= 1200;
};

const ensureUniqueSlug = async (strapi, slug, excludeId) => {
  if (!slug) return;
  const filters = excludeId ? { slug, id: { $ne: excludeId } } : { slug };
  const existing = await strapi.entityService.findMany(ARTICLE_UID, { filters, limit: 1 });
  if (Array.isArray(existing) && existing.length > 0) {
    throw new Error('Slug already exists');
  }
};

const deriveCanonicalUrl = (categorySlug, slug) => {
  const path = categorySlug ? `/${categorySlug}/${slug}` : `/${slug}`;
  return `${SITE_URL}${path}`;
};

const fillSeoFields = (data, existing = null) => {
  const title = data.title || existing?.title || '';
  const excerpt = data.excerpt || existing?.excerpt || '';
  if (!data.seoTitle) data.seoTitle = existing?.seoTitle || title;
  if (!data.meta_description) {
    data.meta_description = existing?.meta_description || truncate(stripHtml(excerpt), 160);
  }
  if (!data.short_headline) data.short_headline = existing?.short_headline || truncate(title, 110);
};

const validateHeadlines = (data) => {
  const title = data.title || '';
  const short = data.short_headline || '';
  if (isAllCaps(title) || isAllCaps(short)) throw new Error('Headline cannot be all caps');
  if (hasExcessivePunctuation(title) || hasExcessivePunctuation(short)) {
    throw new Error('Headline has excessive punctuation');
  }
  if (containsClickbait(title) || containsClickbait(short)) {
    throw new Error('Headline contains clickbait');
  }
};

const setCanonical = async (strapi, data, existing) => {
  const slug = data.slug || existing?.slug || '';
  const categoryId =
    resolveMediaId(data.category) ||
    (data.category && typeof data.category === 'object' ? data.category.id : undefined) ||
    (existing?.category?.id ? existing.category.id : undefined);
  let categorySlug = existing?.category?.slug;
  if (categoryId && !categorySlug) {
    const category = await strapi.entityService.findOne('api::category.category', categoryId, {});
    categorySlug = category?.slug ? String(category.slug) : '';
  }
  const canonicalUrl = slug ? deriveCanonicalUrl(categorySlug, slug) : undefined;
  if (canonicalUrl) {
    data.canonicalUrl = canonicalUrl;
  }
};

const shouldPublishFromData = (data) =>
  data.publishedAt !== undefined && data.publishedAt !== null && data.publishedAt !== '';

const SITEMAP_CACHE_KEY = 'sitemap:xml:v1';

let redisClient = null;
let redisInit = null;

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

const clearSitemapCache = async () => {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(SITEMAP_CACHE_KEY);
  } catch {
    void 0;
  }
};

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signJwtRs256 = (header, payload, privateKey) => {
  const crypto = require('crypto');
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${data}.${base64url(signature)}`;
};

const getGoogleIndexingAccessToken = async () => {
  const clientEmail = String(process.env.GOOGLE_INDEXING_CLIENT_EMAIL ?? '').trim();
  const privateKeyRaw = String(process.env.GOOGLE_INDEXING_PRIVATE_KEY ?? '').trim();
  const privateKey = privateKeyRaw.includes('\\n') ? privateKeyRaw.replace(/\\n/g, '\n') : privateKeyRaw;
  const tokenUri = String(process.env.GOOGLE_INDEXING_TOKEN_URI ?? 'https://oauth2.googleapis.com/token').trim();
  if (!clientEmail || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwtRs256(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
  );

  const form = new URLSearchParams();
  form.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  form.set('assertion', assertion);

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json?.access_token === 'string' ? json.access_token : null;
};

const submitUrlToGoogleIndexing = async (url) => {
  const enabled = String(process.env.GOOGLE_INDEXING_ENABLED ?? '').trim().toLowerCase();
  if (!['1', 'true', 'yes'].includes(enabled)) return;

  const token = await getGoogleIndexingAccessToken();
  if (!token) return;

  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`INDEXING_FAILED:${res.status}:${text || 'unknown'}`);
  }
};

const submitUrlToGoogleIndexingWithRetry = async (strapi, url) => {
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await submitUrlToGoogleIndexing(url);
      return;
    } catch (e) {
      strapi.log.warn(`Google indexing retry ${i + 1}/${attempts} failed for ${url}`);
      if (i === attempts - 1) {
        strapi.log.error(e instanceof Error ? e.message : String(e || 'Indexing error'));
        return;
      }
      const delay = 500 * 2 ** i;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

const resolveArticleUrlForIndexing = async (result) => {
  const canonicalRaw = result?.canonicalUrl ? String(result.canonicalUrl).trim() : '';
  if (canonicalRaw && /^https?:\/\//i.test(canonicalRaw)) return canonicalRaw;
  const slug = result?.slug ? String(result.slug) : '';
  if (!slug) return '';
  const id = result?.id;
  const entity = await strapi.entityService.findOne(ARTICLE_UID, id, { populate: { category: true } });
  const categorySlug = entity?.category?.slug ? String(entity.category.slug) : '';
  if (!categorySlug) return '';
  return `${SITE_URL}/${categorySlug}/${slug}`;
};

const loadInternalLinkMappings = async () => {
  try {
    const list = await strapi.entityService.findMany('api::internal-link.internal-link', {
      filters: { enabled: true },
      sort: [{ priority: 'desc' }],
      limit: 50,
    });
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (!data.slug && data.title) data.slug = toSlug(data.title);
    await ensureUniqueSlug(strapi, data.slug);
    fillSeoFields(data);
    validateHeadlines(data);

    const shouldPublish = shouldPublishFromData(data);
    ensureEditorPublish(strapi, shouldPublish);

    data.discoverEligible = await resolveDiscoverEligibility(strapi, data, null);

    if (shouldPublish) {
      const featuredImageId = resolveMediaId(data.featured_image);
      await validateFeaturedImage(strapi, featuredImageId);
      if (!data.meta_description) throw new Error('Meta description is required');
      if (!data.short_headline) throw new Error('Short headline is required');
      const mappings = await loadInternalLinkMappings();
      if (typeof data.content === 'string' && mappings.length > 0) {
        const applied = applyInternalLinks(data.content, mappings, 5);
        if (applied && typeof applied.html === 'string') data.content = applied.html;
      }
    }

    await setCanonical(strapi, data);
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    const existing = await strapi.entityService.findOne(ARTICLE_UID, where?.id, {
      populate: { category: true, featured_image: true },
    });
    event.state = event.state || {};
    event.state.wasPublished = Boolean(existing?.publishedAt);

    if (!data.slug && data.title) data.slug = toSlug(data.title);
    await ensureUniqueSlug(strapi, data.slug || existing?.slug, where?.id);
    fillSeoFields(data, existing);
    validateHeadlines(data);

    const shouldPublish = shouldPublishFromData(data);
    ensureEditorPublish(strapi, shouldPublish);

    data.discoverEligible = await resolveDiscoverEligibility(strapi, data, existing);

    if (shouldPublish || existing?.publishedAt) {
      const featuredImageId =
        resolveMediaId(data.featured_image) ||
        (existing?.featured_image?.id ? Number(existing.featured_image.id) : undefined);
      await validateFeaturedImage(strapi, featuredImageId);
      if (!data.meta_description && !existing?.meta_description) {
        throw new Error('Meta description is required');
      }
      if (!data.short_headline && !existing?.short_headline) {
        throw new Error('Short headline is required');
      }
      if (shouldPublish && !event.state.wasPublished) {
        const baseContent = typeof data.content === 'string' ? data.content : existing?.content;
        const mappings = await loadInternalLinkMappings();
        if (typeof baseContent === 'string' && mappings.length > 0) {
          const applied = applyInternalLinks(baseContent, mappings, 5);
          if (applied && typeof applied.html === 'string') data.content = applied.html;
        }
      }
    }

    await setCanonical(strapi, data, existing);
  },

  async afterCreate(event) {
    const { result } = event;
    if (!result?.publishedAt) return;
    const publishDiagnostics = String(process.env.PUBLISH_DIAGNOSTICS ?? '').trim().toLowerCase();
    if (publishDiagnostics === '1' || publishDiagnostics === 'true' || publishDiagnostics === 'yes') {
      try {
        strapi.log.info(
          JSON.stringify({
            type: 'publish_event',
            action: 'afterCreate',
            id: result?.id,
            slug: result?.slug,
            publishedAt: result?.publishedAt,
          }),
        );
      } catch {
        void 0;
      }
    }
    await clearSitemapCache();
    try {
      await fetch('https://rampurnews.com/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: result.slug, type: 'article' }),
      });
    } catch {
      void 0;
    }
    try {
      const url = await resolveArticleUrlForIndexing(result);
      if (url) {
        void submitUrlToGoogleIndexingWithRetry(strapi, url);
      }
    } catch {
      void 0;
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    if (!result?.publishedAt) return;
    const publishDiagnostics = String(process.env.PUBLISH_DIAGNOSTICS ?? '').trim().toLowerCase();
    if (publishDiagnostics === '1' || publishDiagnostics === 'true' || publishDiagnostics === 'yes') {
      try {
        strapi.log.info(
          JSON.stringify({
            type: 'publish_event',
            action: 'afterUpdate',
            id: result?.id,
            slug: result?.slug,
            publishedAt: result?.publishedAt,
            wasPublished: Boolean(event?.state?.wasPublished),
          }),
        );
      } catch {
        void 0;
      }
    }
    await clearSitemapCache();
    try {
      await fetch('https://rampurnews.com/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: result.slug, type: 'article' }),
      });
    } catch {
      void 0;
    }
    try {
      const wasPublished = Boolean(event?.state?.wasPublished);
      if (!wasPublished) {
        const url = await resolveArticleUrlForIndexing(result);
        if (url) {
          void submitUrlToGoogleIndexingWithRetry(strapi, url);
        }
      }
    } catch {
      void 0;
    }
  },
};
