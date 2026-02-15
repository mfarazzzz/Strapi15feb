export default async (policyContext: any) => {
  const user = policyContext?.state?.user;
  if (!user) return false;

  const role = user?.role;
  const type = typeof role?.type === 'string' ? role.type : undefined;
  const name = typeof role?.name === 'string' ? role.name : undefined;

  const normalized = (type || name || '').trim().toLowerCase();
  if (!normalized) return false;

  const allowed = new Set(['admin', 'editor', 'author', 'contributor']);
  return allowed.has(normalized);
};

