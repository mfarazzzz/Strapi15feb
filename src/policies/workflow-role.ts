/**
 * workflow-role policy factory
 *
 * Guards publish/approve/reject/unpublish endpoints.
 *
 * SECURITY: Role is derived from the VERIFIED JWT (ctx.state.user populated by
 * the preceding cms-role policy), NOT from the x-cms-role header.
 * Trusting a client-controlled header would allow privilege escalation.
 *
 * Maps Strapi users-permissions role → editorial workflow tier:
 *   reporter / contributor / author  → writer   (rank 1)
 *   editor                           → editor   (rank 2)
 *   admin / authenticated            → publisher (rank 3)
 *
 * Strapi admin panel users always pass.
 */

const ROLE_RANK: Record<string, number> = {
  writer:    1,
  editor:    2,
  publisher: 3,
};

/** Map a Strapi users-permissions role name to a workflow tier */
const toWorkflowTier = (roleType: string): string => {
  const r = roleType.trim().toLowerCase();
  if (r === 'admin' || r === 'super_admin') return 'publisher';
  if (r === 'editor') return 'editor';
  // reporter, contributor, author, writer, authenticated → writer
  return 'writer';
};

export default async (policyContext: any, config: { minRole?: string }, { strapi }: { strapi: any }) => {
  // Strapi admin panel users always pass
  if (policyContext?.state?.admin) return true;

  const user = policyContext?.state?.user;
  if (!user) {
    strapi.log.warn('[workflow-role] No authenticated user in ctx.state.user');
    return false;
  }

  const minRole = config?.minRole ?? 'writer';
  const minRank  = ROLE_RANK[minRole] ?? 0;

  // Resolve the role from the verified user — never from a header
  const role = user?.role;
  const roleType = typeof role?.type === 'string'
    ? role.type
    : typeof role?.name === 'string'
      ? role.name
      : null;

  if (!roleType) {
    // Role not populated — do a DB lookup to get it
    let resolvedType: string | null = null;
    try {
      const full = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { id: user.id }, populate: ['role'] });
      const fullRole = full?.role;
      resolvedType =
        typeof fullRole?.type === 'string' ? fullRole.type
        : typeof fullRole?.name === 'string' ? fullRole.name
        : null;
    } catch {
      void 0;
    }
    if (!resolvedType) {
      strapi.log.warn(`[workflow-role] Could not resolve role for user ${user.id}`);
      return false;
    }
    const tier = toWorkflowTier(resolvedType);
    const userRank = ROLE_RANK[tier] ?? 0;
    if (userRank < minRank) {
      strapi.log.warn(`[workflow-role] User ${user.id} role="${resolvedType}" tier="${tier}" insufficient for minRole="${minRole}"`);
      return false;
    }
    return true;
  }

  const tier = toWorkflowTier(roleType);
  const userRank = ROLE_RANK[tier] ?? 0;

  if (userRank < minRank) {
    strapi.log.warn(`[workflow-role] User ${user.id} role="${roleType}" tier="${tier}" insufficient for minRole="${minRole}"`);
    return false;
  }

  return true;
};
