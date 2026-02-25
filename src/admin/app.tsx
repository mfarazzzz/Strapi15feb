import type { StrapiApp } from '@strapi/strapi/admin';
import type { ContentManagerPlugin } from '@strapi/content-manager/strapi-admin';

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    try {
      const cmApis = app.getPlugin('content-manager').apis as ContentManagerPlugin['config']['apis'];

      // Add a visible action to the List View to reset filters and force ID:DESC ordering
      cmApis.addDocumentAction((actions) => [
        {
          label: 'Reset List (ID DESC)',
          position: ['panel'],
          onClick: () => {
            try {
              // Remove only Content-Manager related saved view preferences
              const keys = Object.keys(window.localStorage).filter(
                (k) =>
                  k.includes('content-manager') ||
                  k.includes('cm.') ||
                  k.includes('cm_') ||
                  k.includes('listView') ||
                  k.includes('collection-types')
              );
              keys.forEach((k) => window.localStorage.removeItem(k));
            } catch {
              // ignore
            }

            // Enforce safe default params on the list view
            const url = new URL(window.location.href);
            const isArticleList =
              url.pathname.includes('/content-manager/collection-types/api::article.article') ||
              url.searchParams.get('model') === 'api::article.article';

            if (isArticleList) {
              url.searchParams.set('page', '1');
              url.searchParams.set('pageSize', '10');
              // Clear any existing sort params first
              url.searchParams.delete('sort');
              url.searchParams.set('sort[0][field]', 'id');
              url.searchParams.set('sort[0][order]', 'DESC');
              window.location.href = url.toString();
              return true;
            }
            return true;
          },
        },
        ...actions,
      ]);
    } catch {
      // In case admin plugin types are unavailable during build, avoid crashing the admin
    }
  },
};

