export default async (policyContext: any) => {
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

  const resolveUserWithRole = async () => {
    const role = user?.role;
    const type = typeof role?.type === 'string' ? role.type : undefined;
    const name = typeof role?.name === 'string' ? role.name : undefined;
    if (type || name) return { type, name };

    const id = user?.id;
    if (!id) return { type: undefined, name: undefined };
    const full = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id }, populate: ['role'] });
    const fullRole = full?.role;
    return {
      type: typeof fullRole?.type === 'string' ? fullRole.type : undefined,
      name: typeof fullRole?.name === 'string' ? fullRole.name : undefined,
    };
  };

  const { type, name } = await resolveUserWithRole();

  if (type === 'admin') return true;
  if (name && name.toLowerCase() === 'admin') return true;

  return false;
};
