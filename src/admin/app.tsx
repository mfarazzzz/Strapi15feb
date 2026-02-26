import React from 'react';
import type { StrapiApp } from '@strapi/strapi/admin';
import type { ContentManagerPlugin } from '@strapi/content-manager/strapi-admin';

const ResetListAction = () => ({
  label: 'Reset List (ID DESC)',
  position: ['panel'],
  onClick: () => {
    try {
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
      void 0;
    }

    const url = new URL(window.location.href);
    const isArticleList =
      url.pathname.includes('/content-manager/collection-types/api::article.article') ||
      url.searchParams.get('model') === 'api::article.article';

    if (isArticleList) {
      url.searchParams.set('page', '1');
      url.searchParams.set('pageSize', '10');
      url.searchParams.delete('sort');
      url.searchParams.set('sort[0][field]', 'id');
      url.searchParams.set('sort[0][order]', 'DESC');
      window.location.href = url.toString();
      return true;
    }
    return true;
  },
});

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    const cmApis = app.getPlugin('content-manager').apis as ContentManagerPlugin['config']['apis'];
    cmApis.addDocumentAction((actions) => [ResetListAction, ...actions]);
  },
};
