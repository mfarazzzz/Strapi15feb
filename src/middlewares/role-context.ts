/**
 * role-context middleware
 *
 * Reads the editorial workflow role from the `x-cms-role` request header
 * (set by the Next.js CMS frontend after login) and attaches it to ctx.state.
 *
 * This is SEPARATE from Strapi's users-permissions roles.
 * Valid values: "writer" | "editor" | "publisher"
 *
 * Usage in controllers:
 *   const role = ctx.state.cmsRole;  // 'writer' | 'editor' | 'publisher' | null
 */

const VALID_ROLES = new Set(['writer', 'editor', 'publisher']);

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    const raw = ctx.request?.header?.['x-cms-role'] ?? ctx.request?.headers?.['x-cms-role'];
    const role = typeof raw === 'string' ? raw.trim().toLowerCase() : null;
    ctx.state.cmsRole = VALID_ROLES.has(role ?? '') ? role : null;
    await next();
  };
};
