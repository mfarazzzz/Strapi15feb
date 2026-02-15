const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const AUTHOR_UID = 'api::author.author';
const UPLOAD_FILE_UID = 'plugin::upload.file';

type CMSRoleType = 'admin' | 'editor' | 'author' | 'contributor';

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeRole = (role: any) => {
  if (!role) return null;
  return {
    id: String(role.id),
    name: typeof role.name === 'string' ? role.name : '',
    type: typeof role.type === 'string' ? role.type : undefined,
    description: typeof role.description === 'string' ? role.description : undefined,
  };
};

const normalizeUser = (user: any) => {
  if (!user) return null;
  return {
    id: String(user.id),
    username: typeof user.username === 'string' ? user.username : '',
    email: typeof user.email === 'string' ? user.email : '',
    confirmed: typeof user.confirmed === 'boolean' ? user.confirmed : false,
    blocked: typeof user.blocked === 'boolean' ? user.blocked : false,
    role: normalizeRole(user.role),
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : undefined,
    updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : undefined,
  };
};

const normalizeRoleType = (role: any): CMSRoleType | undefined => {
  const type = typeof role?.type === 'string' ? role.type : undefined;
  const name = typeof role?.name === 'string' ? role.name : undefined;
  const normalized = String(type || name || '')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'administrator') return 'admin';
  const allowed = new Set<CMSRoleType>(['admin', 'editor', 'author', 'contributor']);
  return allowed.has(normalized as CMSRoleType) ? (normalized as CMSRoleType) : undefined;
};

const parseMediaId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
};

const extractData = (body: any) => {
  if (body?.data && typeof body.data === 'object') return body.data;
  return body ?? {};
};

const extractAuthorData = (value: any) => {
  const source = value?.author && typeof value.author === 'object' ? value.author : value;
  const name = parseString(source?.authorName ?? source?.name);
  const nameHindi = parseString(source?.authorNameHindi ?? source?.nameHindi);
  const bio = parseString(source?.authorBio ?? source?.bio);
  const bioHindi = parseString(source?.authorBioHindi ?? source?.bioHindi);
  const avatarId = parseMediaId(source?.authorAvatarId ?? source?.avatarId ?? source?.avatar);

  const hasAny =
    typeof name === 'string' ||
    typeof nameHindi === 'string' ||
    typeof bio === 'string' ||
    typeof bioHindi === 'string' ||
    typeof avatarId === 'number';

  if (!hasAny) return null;
  return { name, nameHindi, bio, bioHindi, avatarId };
};

export default {
  async list(ctx: any) {
    const page = Math.max(parseNumber(ctx.query?.page) ?? 1, 1);
    const pageSize = Math.min(Math.max(parseNumber(ctx.query?.pageSize) ?? 25, 1), 100);
    const search = parseString(ctx.query?.search) ?? parseString(ctx.query?.q);
    const roleId = parseString(ctx.query?.roleId);
    const roleType = parseString(ctx.query?.roleType);
    const active = (() => {
      const v = ctx.query?.active;
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        if (v.toLowerCase() === 'true') return true;
        if (v.toLowerCase() === 'false') return false;
      }
      return undefined;
    })();

    const and: any[] = [];
    if (search) {
      and.push({
        $or: [{ email: { $containsi: search } }, { username: { $containsi: search } }],
      });
    }
    if (roleId) and.push({ role: { id: roleId } });
    if (roleType) and.push({ role: { type: roleType } });
    if (active !== undefined) and.push({ blocked: active ? false : true });

    const where = and.length > 0 ? { $and: and } : {};

    const start = (page - 1) * pageSize;
    const limit = pageSize;

    const total = await strapi.db.query(USER_UID).count({ where });
    const users = await strapi.db.query(USER_UID).findMany({
      where,
      populate: ['role'],
      orderBy: { createdAt: 'desc' },
      offset: start,
      limit,
    });

    ctx.body = {
      data: (users as any[]).map(normalizeUser).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: total ? Math.ceil(total / pageSize) : 0,
    };
  },

  async findOne(ctx: any) {
    const id = ctx.params?.id;
    const user = await strapi.db.query(USER_UID).findOne({ where: { id }, populate: ['role'] });
    if (!user) {
      ctx.notFound('User not found');
      return;
    }
    ctx.body = normalizeUser(user);
  },

  async roles(ctx: any) {
    const roles = await strapi.db.query(ROLE_UID).findMany({ orderBy: { name: 'asc' } });
    ctx.body = (roles as any[]).map(normalizeRole).filter(Boolean);
  },

  async create(ctx: any) {
    const value = extractData(ctx.request?.body);
    const email = parseString(value?.email);
    const password = parseString(value?.password);
    const username =
      parseString(value?.username) ??
      (email ? email.split('@')[0] : undefined) ??
      `user-${Date.now()}`;
    const roleId = parseString(value?.roleId) ?? parseString(value?.role);
    const roleType = parseString(value?.roleType);
    const confirmed = typeof value?.confirmed === 'boolean' ? value.confirmed : true;
    const blocked = typeof value?.blocked === 'boolean' ? value.blocked : false;
    const authorData = extractAuthorData(value);

    if (!email) {
      ctx.badRequest('email is required');
      return;
    }
    if (!password) {
      ctx.badRequest('password is required');
      return;
    }

    let resolvedRoleId: string | undefined = roleId || undefined;
    if (!resolvedRoleId && roleType) {
      const role = await strapi.db.query(ROLE_UID).findOne({ where: { type: roleType } });
      if (role) resolvedRoleId = String(role.id);
    }
    if (!resolvedRoleId) {
      const role = await strapi.db.query(ROLE_UID).findOne({ where: { type: 'author' } });
      if (role) resolvedRoleId = String(role.id);
    }

    if (!resolvedRoleId) {
      ctx.badRequest('role is required');
      return;
    }

    const userService = strapi.plugin('users-permissions').service('user');
    let createdUser: any | null = null;
    let createdAuthorId: number | null = null;

    try {
      createdUser = await userService.add({
        provider: 'local',
        email,
        username,
        password,
        confirmed,
        blocked,
        role: resolvedRoleId,
      });

      if (authorData) {
        const resolvedRole = await strapi.db.query(ROLE_UID).findOne({ where: { id: resolvedRoleId } });
        const authorRole = normalizeRoleType(resolvedRole) ?? normalizeRoleType(roleType) ?? 'author';
        const authorName = authorData.name ?? username ?? email.split('@')[0] ?? 'Author';

        const createdAuthor = await strapi.entityService.create(AUTHOR_UID, {
          data: {
            name: authorName,
            nameHindi: authorData.nameHindi,
            email,
            bio: authorData.bio,
            bioHindi: authorData.bioHindi,
            role: authorRole,
            user: createdUser?.id,
            avatar: authorData.avatarId ? authorData.avatarId : undefined,
          },
        });

        createdAuthorId =
          typeof (createdAuthor as any)?.id === 'number' ? (createdAuthor as any).id : null;
      }

      const user = await strapi.db.query(USER_UID).findOne({ where: { id: createdUser?.id }, populate: ['role'] });
      ctx.status = 201;
      ctx.body = normalizeUser(user);
    } catch (error: any) {
      const avatarId = authorData?.avatarId;
      if (createdAuthorId) {
        try {
          await strapi.entityService.delete(AUTHOR_UID, createdAuthorId);
        } catch {
          void 0;
        }
      }
      if (createdUser?.id) {
        try {
          await userService.remove({ id: createdUser.id });
        } catch {
          void 0;
        }
      }
      if (avatarId) {
        try {
          await strapi.entityService.delete(UPLOAD_FILE_UID, avatarId);
        } catch {
          void 0;
        }
      }
      const message = typeof error?.message === 'string' && error.message.trim() ? error.message : 'Failed to create user';
      ctx.badRequest(message);
    }
  },

  async update(ctx: any) {
    const id = ctx.params?.id;
    const userId = parseNumber(id) ?? id;
    const value = extractData(ctx.request?.body);

    const email = parseString(value?.email);
    const username = parseString(value?.username);
    const password = parseString(value?.password);
    const confirmed = typeof value?.confirmed === 'boolean' ? value.confirmed : undefined;
    const blocked = typeof value?.blocked === 'boolean' ? value.blocked : undefined;
    const roleId = parseString(value?.roleId) ?? parseString(value?.role);
    const roleType = parseString(value?.roleType);
    const authorData = extractAuthorData(value);

    const patch: Record<string, any> = {};
    if (email) patch.email = email;
    if (username) patch.username = username;
    if (password) patch.password = password;
    if (confirmed !== undefined) patch.confirmed = confirmed;
    if (blocked !== undefined) patch.blocked = blocked;

    let resolvedRoleId: string | undefined = roleId || undefined;
    if (!resolvedRoleId && roleType) {
      const role = await strapi.db.query(ROLE_UID).findOne({ where: { type: roleType } });
      if (role) resolvedRoleId = String(role.id);
    }
    if (resolvedRoleId) patch.role = resolvedRoleId;

    const userService = strapi.plugin('users-permissions').service('user');
    const before = await strapi.db.query(USER_UID).findOne({ where: { id: userId }, populate: ['role'] });
    if (!before) {
      ctx.notFound('User not found');
      return;
    }
    const beforeRoleId = before?.role?.id ? String(before.role.id) : undefined;

    try {
      await userService.edit(id, patch);
      const updated = await strapi.db.query(USER_UID).findOne({ where: { id: userId }, populate: ['role'] });
      if (!updated) {
        ctx.notFound('User not found');
        return;
      }

      const shouldSyncAuthor =
        !!authorData ||
        typeof email === 'string' ||
        typeof resolvedRoleId === 'string' ||
        typeof roleType === 'string';

      if (shouldSyncAuthor) {
        const existingAuthor = await strapi.db.query(AUTHOR_UID).findOne({ where: { user: userId } });
        const finalRoleType = normalizeRoleType(updated?.role) ?? normalizeRoleType(roleType) ?? 'author';
        const finalEmail = typeof updated?.email === 'string' ? updated.email : undefined;

        const authorPatch: Record<string, any> = {};
        if (finalEmail) authorPatch.email = finalEmail;
        if (authorData?.name) authorPatch.name = authorData.name;
        if (authorData?.nameHindi) authorPatch.nameHindi = authorData.nameHindi;
        if (authorData?.bio) authorPatch.bio = authorData.bio;
        if (authorData?.bioHindi) authorPatch.bioHindi = authorData.bioHindi;
        if (authorData?.avatarId !== undefined) authorPatch.avatar = authorData.avatarId || null;
        authorPatch.role = finalRoleType;

        if (existingAuthor) {
          await strapi.entityService.update(AUTHOR_UID, existingAuthor.id, { data: authorPatch });
        } else if (authorData) {
          await strapi.entityService.create(AUTHOR_UID, {
            data: {
              name:
                authorData.name ??
                (typeof updated?.username === 'string' ? updated.username : undefined) ??
                (finalEmail ? finalEmail.split('@')[0] : undefined) ??
                'Author',
              nameHindi: authorData.nameHindi,
              email: finalEmail ?? (typeof before?.email === 'string' ? before.email : ''),
              bio: authorData.bio,
              bioHindi: authorData.bioHindi,
              role: finalRoleType,
              user: updated.id,
              avatar: authorData.avatarId ? authorData.avatarId : undefined,
            },
          });
        }
      }

      ctx.body = normalizeUser(updated);
    } catch (error: any) {
      try {
        const rollback: Record<string, any> = {};
        if (typeof before?.email === 'string') rollback.email = before.email;
        if (typeof before?.username === 'string') rollback.username = before.username;
        if (typeof before?.confirmed === 'boolean') rollback.confirmed = before.confirmed;
        if (typeof before?.blocked === 'boolean') rollback.blocked = before.blocked;
        if (beforeRoleId) rollback.role = beforeRoleId;
        await userService.edit(id, rollback);
      } catch {
        void 0;
      }
      const message = typeof error?.message === 'string' && error.message.trim() ? error.message : 'Failed to update user';
      ctx.badRequest(message);
    }
  },

  async delete(ctx: any) {
    const id = ctx.params?.id;
    const userId = parseNumber(id) ?? id;
    const userService = strapi.plugin('users-permissions').service('user');
    const existing = await userService.fetch(id, { populate: ['role'] });
    if (!existing) {
      ctx.notFound('User not found');
      return;
    }
    const author = await strapi.db.query(AUTHOR_UID).findOne({ where: { user: userId } });
    if (author) {
      await strapi.entityService.delete(AUTHOR_UID, author.id);
    }
    await userService.remove({ id });
    ctx.status = 204;
  },
};
