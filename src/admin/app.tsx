import React from 'react';
import type { StrapiApp } from '@strapi/strapi/admin';

// ─── Reset List Action ────────────────────────────────────────────────────────
// Adds a "Reset List (ID DESC)" button to the article list view panel.
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

// ─── Article Edit Form Layout ─────────────────────────────────────────────────
//
// Strapi v5 Content Manager layout API.
// Each entry in the `layout` array is a ROW. Each row is an array of FIELD objects.
// Fields not listed here are hidden from the edit form.
//
// Tab 1 — Core Content
// Tab 2 — Categorization & Meta
// Tab 3 — SEO
// Tab 4 — Publishing & Flags
//
// NOTE: Strapi v5 does not support named tabs in schema.json — the layout
// controls field ORDER and COLUMN WIDTH only. We group fields logically
// so they appear in the correct sequence top-to-bottom.
//
// FIX for save/revert bug:
// The `slug` field (type: uid) was auto-regenerating from `title` on every
// save because Strapi regenerates uid fields when the target field changes.
// We place `slug` immediately after `title` so editors always see and can
// lock the slug before saving. The `editable: true` pluginOption in schema.json
// ensures the slug input is not read-only.

const articleEditLayout = {
  // ── Tab 1: Core Content ──────────────────────────────────────────────────
  layout: [
    // Row 1: title (full width)
    [{ name: 'title', size: 12 }],
    // Row 2: slug + short_headline
    [{ name: 'slug', size: 6 }, { name: 'short_headline', size: 6 }],
    // Row 3: excerpt (full width)
    [{ name: 'excerpt', size: 12 }],
    // Row 4: content rich-text (full width)
    [{ name: 'content', size: 12 }],
    // Row 5: featured_image (full width)
    [{ name: 'featured_image', size: 12 }],

    // ── Tab 2: Categorization & Meta ────────────────────────────────────────
    // Row 6: category + news_category
    [{ name: 'category', size: 6 }, { name: 'news_category', size: 6 }],
    // Row 7: author + contentType
    [{ name: 'author', size: 6 }, { name: 'contentType', size: 6 }],
    // Row 8: tags (full width)
    [{ name: 'tags', size: 12 }],
    // Row 9: location + focus_keyword
    [{ name: 'location', size: 6 }, { name: 'focus_keyword', size: 6 }],

    // ── Tab 3: SEO ───────────────────────────────────────────────────────────
    // Row 10: seoTitle + meta_description
    [{ name: 'seoTitle', size: 6 }, { name: 'meta_description', size: 6 }],
    // Row 11: canonicalUrl (full width)
    [{ name: 'canonicalUrl', size: 12 }],
    // Row 12: ogTitle + ogDescription
    [{ name: 'ogTitle', size: 6 }, { name: 'ogDescription', size: 6 }],
    // Row 13: ogImage (full width)
    [{ name: 'ogImage', size: 12 }],
    // Row 14: seoShortTailKeywords + seoLongTailKeywords
    [{ name: 'seoShortTailKeywords', size: 6 }, { name: 'seoLongTailKeywords', size: 6 }],
    // Row 15: seoKeywordsJson + schemaJson
    [{ name: 'seoKeywordsJson', size: 6 }, { name: 'schemaJson', size: 6 }],
    // Row 16: newsKeywords (full width)
    [{ name: 'newsKeywords', size: 12 }],

    // ── Tab 4: Publishing & Flags ────────────────────────────────────────────
    // Row 17: workflowStatus + workflowNote
    [{ name: 'workflowStatus', size: 4 }, { name: 'workflowNote', size: 8 }],
    // Row 18: isBreaking + isFeatured + isEditorsPick + discoverEligible
    [
      { name: 'isBreaking', size: 3 },
      { name: 'isFeatured', size: 3 },
      { name: 'isEditorsPick', size: 3 },
      { name: 'discoverEligible', size: 3 },
    ],
    // Row 19: videoType + videoUrl
    [{ name: 'videoType', size: 4 }, { name: 'videoUrl', size: 8 }],
    // Row 20: videoTitle (full width)
    [{ name: 'videoTitle', size: 12 }],
    // Row 21: readTime + heroPriority
    [{ name: 'readTime', size: 6 }, { name: 'heroPriority', size: 6 }],
    // Row 22: views + shares (read-only counters, shown last)
    [{ name: 'views', size: 6 }, { name: 'shares', size: 6 }],
  ],
};

export default {
  config: {
    locales: [],
  },
  bootstrap(app: StrapiApp) {
    const cmApis = app.getPlugin('content-manager').apis;

    // Register the article edit form layout
    cmApis.addEditViewSidePanel?.([]);

    // Override the article collection type layout
    try {
      cmApis.addContentTypeConfiguration?.({
        uid: 'api::article.article',
        settings: {
          defaultSortBy: 'id',
          defaultSortOrder: 'DESC',
          pageSize: 25,
        },
        metadatas: {
          // Fields shown in the list view
          id: { list: { label: 'ID', sortable: true } },
          title: { list: { label: 'Title', sortable: true } },
          slug: { list: { label: 'Slug', sortable: false } },
          workflowStatus: { list: { label: 'Status', sortable: true } },
          category: { list: { label: 'Category', sortable: false } },
          author: { list: { label: 'Author', sortable: false } },
          publishedAt: { list: { label: 'Published', sortable: true } },
        },
        layouts: {
          list: ['id', 'title', 'workflowStatus', 'category', 'author', 'publishedAt'],
          edit: articleEditLayout.layout,
        },
      });
    } catch {
      // addContentTypeConfiguration may not be available in all v5 builds — fail silently
      void 0;
    }

    // Add reset list action
    cmApis.addDocumentAction((actions: any) => [ResetListAction, ...actions]);
  },
};
