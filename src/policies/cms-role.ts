export default async (policyContext: any) => {
  if (policyContext?.state?.admin) return true;
  let user = policyContext?.state?.user;
  if (!user) {
    const auth =
      policyContext?.request?.header?.authorization ??
      policyContext?.request?.headers?.authorization ??
      policyContext?.headers?.authorization;
    const raw = typeof auth === 'string' ? auth.trim() : '';
    if (raw.toLowerCase().startsWith('bearer ')) {
      const token = raw.slice(7).trim();
      if (token) {
        try {
          const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
          const id = payload?.id;
          if (id) {
            user = await strapi.db
              .query('plugin::users-permissions.user')
              .findOne({ where: { id }, populate: ['role'] });
            if (user) policyContext.state.user = user;
          }
        } catch {
          void 0;
        }
      }
    }
  }

  if (!user) return false;

  const role = user?.role;
  const type = typeof role?.type === 'string' ? role.type : undefined;
  const name = typeof role?.name === 'string' ? role.name : undefined;

  const normalized = (type || name || '').trim().toLowerCase();
  if (!normalized) return false;

  const allowed = new Set(['admin', 'editor', 'author', 'contributor', 'reporter', 'authenticated']);
  const isAllowed = allowed.has(normalized);
  if (!isAllowed) {
    strapi.log.warn(`Policy blocked user ${user.id} with role ${normalized}`);
  }
  return isAllowed;
};

