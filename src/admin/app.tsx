import React, { useState } from 'react';
import type { StrapiApp } from '@strapi/strapi/admin';
import { useCMEditViewDataManager } from '@strapi/content-manager/strapi-admin';
import { Button } from '@strapi/design-system';
import { Magic } from '@strapi/icons';

/**
 * AI Article Generator Action
 * Fetches the draft field and calls our /api/ai/generate endpoint.
 * Then populates the fields in the Strapi editor.
 */
const AIArticleAction = () => {
  const { 
    initialData, 
    onChange, 
    isCreatingEntry, 
    slug: modelSlug 
  } = useCMEditViewDataManager();
  const [loading, setLoading] = useState(false);

  // Only show for the article content type
  if (modelSlug !== 'api::article.article') {
    return null;
  }

  const handleGenerate = async () => {
    // We assume the draft field is where the user puts the raw input
    // If your draft field has a different name, change it here.
    const draftContent = initialData.draft || initialData.content_draft || '';

    if (!draftContent) {
      alert('Please enter some text in the draft field first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authorization token is handled by the browser's session for admin requests
          'Authorization': `Bearer ${window.sessionStorage.getItem('jwtToken') || ''}`
        },
        body: JSON.stringify({ draft: draftContent }),
      });

      if (!response.ok) {
        throw new Error('AI Generation failed');
      }

      const data = await response.json();

      // Populate fields automatically
      // Mapping from AI response to Strapi content type fields
      const fieldMap: Record<string, any> = {
        title: data.title,
        content: data.content,
        slug: data.slug,
        excerpt: data.excerpt,
        seoTitle: data.seo_title,
        metaDescription: data.meta_description,
        focusKeyword: data.focus_keyword,
        shortHeadline: data.short_headline,
        schemaJson: data.schema_json,
        imageAltText: data.image_alt_text,
        author: data.author,
        category: data.category,
        tags: data.tags,
      };

      // Apply changes to the form
      Object.keys(fieldMap).forEach((key) => {
        if (fieldMap[key]) {
          onChange({ target: { name: key, value: fieldMap[key] } });
        }
      });

      alert('AI Article Generated Successfully!');
    } catch (error) {
      console.error('AI Generation Error:', error);
      alert('Failed to generate article with AI. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return {
    label: 'Generate with AI',
    variant: 'secondary',
    startIcon: <Magic />,
    loading,
    onClick: handleGenerate,
  };
};

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
  bootstrap(app: any) {
    const cmApis = app.getPlugin('content-manager').apis;
    
    // Add reset list action
    cmApis.addDocumentAction((actions: any) => [ResetListAction, ...actions]);
    
    // Add AI generation action to the edit view
    cmApis.addDocumentAction((actions: any) => [AIArticleAction, ...actions]);
  },
};
