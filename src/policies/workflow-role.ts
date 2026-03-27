/**
 * workflow-role policy factory
 *
 * Usage in routes:
 *   config: { auth: {}, policies: [{ name: 'global::workflow-role', config: { minRole: 'editor' } }] }
 *
 * Role hierarchy: writer < editor < publisher
 */

const ROLE_RANK: Record<string, number> = {
  writer:    1,
  editor:    2,
  publisher: 3,
};

export default async (policyContext: any, config: { minRole?: string }, { strapi }: { strapi: any }) => {
  // Strapi admin panel users always pass
  if (policyContext?.state?.admin) return true;

  const cmsRole = policyContext?.state?.cmsRole as string | null;
  const minRole = config?.minRole ?? 'writer';

  if (!cmsRole) {
    strapi.log.warn('[workflow-role] No x-cms-role header present');
    return false;
  }

  const userRank = ROLE_RANK[cmsRole] ?? 0;
  const minRank  = ROLE_RANK[minRole] ?? 0;

  if (userRank < minRank) {
    strapi.log.warn(`[workflow-role] Role "${cmsRole}" insufficient for minRole "${minRole}"`);
    return false;
  }

  return true;
};
