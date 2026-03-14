const ARTICLE_UID = 'api::article.article';

import { TRENDING_SORT } from '../../../utils/articleSort';

type TrendingOptions = {
  limit?: number;
  lookbackDays?: number;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const computeRecentness = (publishedAtIso: string) => {
  const ts = new Date(publishedAtIso).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  const ageHours = (Date.now() - ts) / 3600_000;
  const decay = Math.exp(-ageHours / 24);
  return decay * 1000;
};

export const computeTrendingScore = (input: { views: number; shares: number; publishedAt: string }) => {
  const views = Number.isFinite(Number(input.views)) ? Number(input.views) : 0;
  const shares = Number.isFinite(Number(input.shares)) ? Number(input.shares) : 0;
  const recentness = computeRecentness(input.publishedAt);
  return views * 0.6 + recentness * 0.3 + shares * 0.1;
};

export const getTrendingEntities = async (strapi: any, options: TrendingOptions = {}) => {
  const limit = clamp(Number(options.limit ?? 10), 1, 50);
  const lookbackDays = clamp(Number(options.lookbackDays ?? 7), 1, 30);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const candidates = await strapi.entityService.findMany(ARTICLE_UID, {
    filters: { publishedAt: { $gte: since } },
    // Using TRENDING_SORT for deterministic ordering when views/publishedAt are equal
    sort: TRENDING_SORT,
    fields: [
      'title',
      'short_headline',
      'slug',
      'excerpt',
      'publishedAt',
      'createdAt',
      'updatedAt',
      'readTime',
      'isFeatured',
      'isBreaking',
      'isEditorsPick',
      'contentType',
      'views',
      'shares',
      'focus_keyword',
      'location',
      'news_category',
      'seoTitle',
      'discoverEligible',
      'canonicalUrl',
      'newsKeywords',
      'meta_description',
      'videoUrl',
      'videoType',
      'videoTitle',
    ],
    populate: {
      featured_image: true,
      category: true,
      categories: true,
      author: { populate: { avatar: true } },
      tags: true,
    },
    limit: 250,
    publicationState: 'live',
  });

  const list = Array.isArray(candidates) ? (candidates as any[]) : [];
  const scored = list
    .map((entity) => {
      const views = typeof entity?.views === 'number' ? entity.views : Number(entity?.views) || 0;
      const shares = typeof entity?.shares === 'number' ? entity.shares : Number(entity?.shares) || 0;
      const publishedAt = typeof entity?.publishedAt === 'string' ? entity.publishedAt : '';
      const score = publishedAt ? computeTrendingScore({ views, shares, publishedAt }) : views * 0.6 + shares * 0.1;
      return { entity, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entity);
};

export default {
  getTrendingEntities,
  computeTrendingScore,
};
