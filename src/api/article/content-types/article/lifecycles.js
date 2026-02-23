const ARTICLE_UID = 'api::article.article';
const UPLOAD_FILE_UID = 'plugin::upload.file';
const SITE_URL =
  typeof process.env.SITE_URL === 'string' && process.env.SITE_URL.trim()
    ? process.env.SITE_URL.trim().replace(/\/+$/, '')
    : 'https://rampurnews.com';

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

const syncFlags = (data) => {
  if (data.isFeatured !== undefined && data.is_featured === undefined) {
    data.is_featured = Boolean(data.isFeatured);
  }
  if (data.is_featured !== undefined && data.isFeatured === undefined) {
    data.isFeatured = Boolean(data.is_featured);
  }
  if (data.isBreaking !== undefined && data.is_breaking === undefined) {
    data.is_breaking = Boolean(data.isBreaking);
  }
  if (data.is_breaking !== undefined && data.isBreaking === undefined) {
    data.isBreaking = Boolean(data.is_breaking);
  }
};

const fillSeoFields = (data, existing = null) => {
  const title = data.title || existing?.title || '';
  const excerpt = data.excerpt || existing?.excerpt || '';
  if (!data.seo_title) data.seo_title = existing?.seo_title || title;
  if (!data.meta_description) data.meta_description = existing?.meta_description || truncate(stripHtml(excerpt), 160);
  if (!data.seoTitle) data.seoTitle = existing?.seoTitle || data.seo_title || title;
  if (!data.seoDescription) {
    data.seoDescription =
      existing?.seoDescription || data.meta_description || truncate(stripHtml(excerpt), 160);
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
    if (!data.seo) data.seo = {};
    if (!data.seo.canonicalURL) data.seo.canonicalURL = canonicalUrl;
  }
};

const shouldPublishFromData = (data) =>
  data.publishedAt !== undefined && data.publishedAt !== null && data.publishedAt !== '';

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    syncFlags(data);

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
    }

    await setCanonical(strapi, data);
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;
    syncFlags(data);

    const existing = await strapi.entityService.findOne(ARTICLE_UID, where?.id, {
      populate: { category: true, featured_image: true },
    });

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
    }

    await setCanonical(strapi, data, existing);
  },

  async afterCreate(event) {
    const { result } = event;
    if (!result?.publishedAt) return;
    try {
      await fetch('https://rampurnews.com/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: result.slug, type: 'article' }),
      });
    } catch {
      void 0;
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    if (!result?.publishedAt) return;
    try {
      await fetch('https://rampurnews.com/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: result.slug, type: 'article' }),
      });
    } catch {
      void 0;
    }
  },
};
