const MAX_PAGE_SIZE = 100;

export default async (policyContext: any) => {
  const ctx = policyContext;
  if (!ctx || !ctx.query) return true;
  if (ctx.state?.admin) return true;

  if (!ctx.query.publicationState) {
    ctx.query.publicationState = 'live';
  }

  if (!ctx.query.sort) {
    ctx.query.sort = 'publishedAt:desc';
  }

  // Do NOT inject a default locale. The article/category/author content types
  // are not i18n-enabled (no locale field in their schemas). Injecting
  // locale='hi' causes Strapi to filter by locale and silently return 0 results
  // for content that was created without a locale assignment.
  // i18n is enabled in plugins.ts for future use but is not active on these types.

  const pagination = typeof ctx.query.pagination === 'object' && ctx.query.pagination ? ctx.query.pagination : {};
  const pageRaw = pagination.page ?? ctx.query.page;
  const pageSizeRaw = pagination.pageSize ?? ctx.query.pageSize;

  const page = Number(pageRaw);
  const pageSize = Number(pageSizeRaw);

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, MAX_PAGE_SIZE) : 25;

  ctx.query.pagination = { ...pagination, page: safePage, pageSize: safePageSize };

  return true;
};
