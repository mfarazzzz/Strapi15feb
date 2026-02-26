const MAX_PAGE_SIZE = 100;

export default async (policyContext: any) => {
  const ctx = policyContext;
  if (!ctx || !ctx.query) return true;

  if (!ctx.query.publicationState) {
    ctx.query.publicationState = 'live';
  }

  if (!ctx.query.sort) {
    ctx.query.sort = 'publishedAt:desc';
  }

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

