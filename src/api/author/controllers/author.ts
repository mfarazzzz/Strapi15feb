import { factories } from '@strapi/strapi';

const AUTHOR_UID = 'api::author.author';
const UPLOAD_FILE_UID = 'plugin::upload.file';

const toAbsoluteUrl = (origin: string, url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
};

const parseString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const AUTHOR_ROLES = ['admin', 'editor', 'author', 'contributor'] as const;
type AuthorRole = (typeof AUTHOR_ROLES)[number];

const parseAuthorRole = (value: unknown): AuthorRole | undefined => {
  const role = parseString(value);
  if (!role) return undefined;
  if ((AUTHOR_ROLES as readonly string[]).includes(role)) return role as AuthorRole;
  return undefined;
};

const parseRelationId = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = typeof value === 'string' ? value.trim() : value;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const normalizeAuthor = (entity: any, origin: string) => {
  if (!entity) return null;
  const avatarUrl =
    entity?.avatar?.url && typeof entity.avatar.url === 'string'
      ? toAbsoluteUrl(origin, entity.avatar.url)
      : undefined;
  return {
    id: String(entity.id),
    name: entity?.name ? String(entity.name) : '',
    nameHindi: entity?.nameHindi ? String(entity.nameHindi) : '',
    email: entity?.email ? String(entity.email) : '',
    avatar: avatarUrl,
    bio: entity?.bio ? String(entity.bio) : undefined,
    bioHindi: entity?.bioHindi ? String(entity.bioHindi) : undefined,
    role: parseAuthorRole(entity?.role) ?? 'author',
    userId: entity?.user?.id ? String(entity.user.id) : undefined,
    createdAt: typeof entity?.createdAt === 'string' ? entity.createdAt : undefined,
    updatedAt: typeof entity?.updatedAt === 'string' ? entity.updatedAt : undefined,
  };
};

export default factories.createCoreController('api::author.author', ({ strapi }) => ({
  async find(ctx) {
    const origin = ctx.request.origin || '';
    const entities = await strapi.entityService.findMany(AUTHOR_UID, {
      sort: { name: 'asc' },
      limit: 1000,
      populate: { avatar: true, user: { populate: { role: true } } },
    });
    return (entities as any[]).map((e) => normalizeAuthor(e, origin)).filter(Boolean);
  },

  async findOne(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const entity = await strapi.entityService.findOne(AUTHOR_UID, id, {
      populate: { avatar: true, user: { populate: { role: true } } },
    });
    if (!entity) {
      ctx.notFound('Author not found');
      return;
    }
    return normalizeAuthor(entity, origin);
  },

  async create(ctx) {
    const origin = ctx.request.origin || '';
    const input = (() => {
      const body = ctx.request.body ?? {};
      if (body?.data && typeof body.data === 'object') return body.data;
      return body;
    })();

    const resolveUploadFileIdByUrl = async (value: unknown): Promise<number | undefined> => {
      const raw = parseString(value);
      if (!raw) return undefined;
      let pathname = raw;
      try {
        const u = new URL(raw, origin);
        pathname = u.pathname;
      } catch {
        void 0;
      }
      const found = await strapi.db.query(UPLOAD_FILE_UID).findOne({ where: { url: pathname } });
      return found?.id ? Number(found.id) : undefined;
    };

    const resolveAvatarId = async (value: unknown): Promise<number | null | undefined> => {
      if (value === null || value === '') return null;
      const direct = parseRelationId(value);
      if (direct) return direct;
      if (typeof value === 'string') return await resolveUploadFileIdByUrl(value);
      return undefined;
    };

    const avatarId = await resolveAvatarId(input?.avatar ?? input?.avatarId);
    const roleRaw = input?.role;
    const role = parseAuthorRole(roleRaw);
    if (roleRaw !== undefined && roleRaw !== null && roleRaw !== '' && !role) {
      ctx.badRequest('Invalid author role');
      return;
    }
    const entity = await strapi.entityService.create(AUTHOR_UID, {
      data: {
        name: parseString(input?.name) ?? '',
        nameHindi: parseString(input?.nameHindi),
        email: parseString(input?.email) ?? '',
        bio: parseString(input?.bio),
        bioHindi: parseString(input?.bioHindi),
        role: role ?? 'author',
        user: parseRelationId(input?.user) ?? undefined,
        avatar: avatarId === null ? null : avatarId ?? undefined,
      },
      populate: { avatar: true, user: { populate: { role: true } } },
    });
    return normalizeAuthor(entity, origin);
  },

  async update(ctx) {
    const origin = ctx.request.origin || '';
    const id = ctx.params.id;
    const input = (() => {
      const body = ctx.request.body ?? {};
      if (body?.data && typeof body.data === 'object') return body.data;
      return body;
    })();

    const resolveUploadFileIdByUrl = async (value: unknown): Promise<number | undefined> => {
      const raw = parseString(value);
      if (!raw) return undefined;
      let pathname = raw;
      try {
        const u = new URL(raw, origin);
        pathname = u.pathname;
      } catch {
        void 0;
      }
      const found = await strapi.db.query(UPLOAD_FILE_UID).findOne({ where: { url: pathname } });
      return found?.id ? Number(found.id) : undefined;
    };

    const resolveAvatarId = async (value: unknown): Promise<number | null | undefined> => {
      if (value === null || value === '') return null;
      const direct = parseRelationId(value);
      if (direct) return direct;
      if (typeof value === 'string') return await resolveUploadFileIdByUrl(value);
      return undefined;
    };

    const patch: Record<string, any> = {};
    if (parseString(input?.name)) patch.name = parseString(input?.name);
    if (input?.nameHindi !== undefined) patch.nameHindi = parseString(input?.nameHindi) ?? null;
    if (parseString(input?.email)) patch.email = parseString(input?.email);
    if (input?.bio !== undefined) patch.bio = parseString(input?.bio) ?? null;
    if (input?.bioHindi !== undefined) patch.bioHindi = parseString(input?.bioHindi) ?? null;
    if (input?.role !== undefined) {
      if (input?.role === null || input?.role === '') patch.role = 'author';
      else {
        const role = parseAuthorRole(input?.role);
        if (!role) {
          ctx.badRequest('Invalid author role');
          return;
        }
        patch.role = role;
      }
    }
    if (input?.user !== undefined) patch.user = parseRelationId(input?.user) ?? null;

    if (input?.avatar !== undefined || input?.avatarId !== undefined) {
      const avatarId = await resolveAvatarId(input?.avatar ?? input?.avatarId);
      if (avatarId === null) patch.avatar = null;
      else if (avatarId !== undefined) patch.avatar = avatarId;
    }

    const entity = await strapi.entityService.update(AUTHOR_UID, id, {
      data: patch,
      populate: { avatar: true, user: { populate: { role: true } } },
    });
    return normalizeAuthor(entity, origin);
  },

  async delete(ctx) {
    const id = ctx.params.id;
    await strapi.entityService.delete(AUTHOR_UID, id);
    ctx.status = 204;
  },
}));
