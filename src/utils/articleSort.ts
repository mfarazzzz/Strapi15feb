/**
 * Centralized article sorting configuration
 * 
 * Ensures deterministic ordering across all article queries.
 * When multiple articles share the same publishedAt timestamp,
 * the id field provides a stable secondary sort order.
 */

export const ARTICLE_SORT = [
  { publishedAt: 'desc' },
  { id: 'desc' }
] as const;

/**
 * Sort configuration for trending articles (views-based)
 * Includes publishedAt and id for determinism when views are equal
 */
export const TRENDING_SORT = [
  { views: 'desc' },
  { publishedAt: 'desc' },
  { id: 'desc' }
] as const;

export default ARTICLE_SORT;
