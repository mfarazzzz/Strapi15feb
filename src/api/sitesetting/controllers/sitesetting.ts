import { factories } from '@strapi/strapi';

const normalizeSiteSetting = (entity: any) => {
  if (!entity) return null;
  const { id, ...rest } = entity;
  return {
    id: String(id),
    ...rest,
  };
};

const getOrCreateSiteSetting = async (strapi: any) => {
  const existing = (await (strapi.entityService as any).findMany('api::sitesetting.sitesetting', {
    limit: 1,
  })) as any[];
  const entity = existing?.[0];
  if (entity) return entity;
  return await (strapi.entityService as any).create('api::sitesetting.sitesetting', { data: {} });
};

const pickSiteSettingPayload = (value: any) => ({
  siteName: value?.siteName ?? 'Rampur News',
  siteNameHindi: value?.siteNameHindi ?? 'रामपुर न्यूज़',
  tagline: value?.tagline ?? undefined,
  taglineHindi: value?.taglineHindi ?? undefined,
  logo: value?.logo ?? undefined,
  favicon: value?.favicon ?? undefined,
  socialLinks: value?.socialLinks ?? undefined,
  contactEmail: value?.contactEmail ?? undefined,
  contactPhone: value?.contactPhone ?? undefined,
  address: value?.address ?? undefined,
  defaultAuthorRole: value?.defaultAuthorRole ?? 'author',
  googleAnalyticsId: value?.googleAnalyticsId ?? undefined,
  googleAdsenseId: value?.googleAdsenseId ?? undefined,
  footerText: value?.footerText ?? undefined,
  footerTextHindi: value?.footerTextHindi ?? undefined,
  gscPropertyUrl: value?.gscPropertyUrl ?? undefined,
  gscExportUrl: value?.gscExportUrl ?? undefined,
  backlinkReportUrl: value?.backlinkReportUrl ?? undefined,
  referringDomains: value?.referringDomains ?? undefined,
  backlinkNotes: value?.backlinkNotes ?? undefined,
  lastBacklinkSync: value?.lastBacklinkSync ?? undefined,
});

export default factories.createCoreController('api::sitesetting.sitesetting' as any, ({ strapi }) => ({
  async get(ctx) {
    const entity = await getOrCreateSiteSetting(strapi);
    const hydrated = await (strapi.entityService as any).findOne('api::sitesetting.sitesetting', entity.id, {
      populate: {
        logo: true,
        favicon: true,
        socialLinks: true,
        address: true,
      },
    });
    const normalized = normalizeSiteSetting(hydrated);
    if (!normalized) {
      ctx.notFound('SiteSetting not found');
      return;
    }
    return pickSiteSettingPayload(normalized);
  },

  async updateSettings(ctx) {
    const body = ctx.request.body ?? {};
    const value = body?.data && typeof body.data === 'object' ? body.data : body;
    const entity = await getOrCreateSiteSetting(strapi);
    const updated = await (strapi.entityService as any).update('api::sitesetting.sitesetting', entity.id, {
      data: value,
      populate: {
        logo: true,
        favicon: true,
        socialLinks: true,
        address: true,
      },
    });
    const normalized = normalizeSiteSetting(updated);
    return pickSiteSettingPayload(normalized);
  },
}));
