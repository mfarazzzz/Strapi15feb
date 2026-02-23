const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const ARTICLE_UID = 'api::article.article';
const PAGE_SIZE = 500;

const stripHtml = (value) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildIssues = (flags) =>
  Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join('; ');

const run = async () => {
  const strapi = await createStrapi();
  await strapi.load();

  const rows = [];
  let start = 0;
  while (true) {
    const batch = await strapi.entityService.findMany(ARTICLE_UID, {
      limit: PAGE_SIZE,
      start,
      publicationState: 'live',
      populate: { featured_image: true, author: true },
      sort: { publishedAt: 'desc' },
    });
    const list = Array.isArray(batch) ? batch : [];
    if (list.length === 0) break;

    for (const entity of list) {
      const title = entity?.title ? String(entity.title) : '';
      const slug = entity?.slug ? String(entity.slug) : '';
      const publishedAt = entity?.publishedAt ? String(entity.publishedAt) : '';
      const featuredImage = entity?.featured_image || null;
      const featuredImageUrl = featuredImage?.url ? String(featuredImage.url) : '';
      const featuredImageWidth = typeof featuredImage?.width === 'number' ? featuredImage.width : 0;
      const author = entity?.author || null;
      const authorName = author?.name ? String(author.name) : author?.nameHindi ? String(author.nameHindi) : '';
      const authorBioRaw = author?.bio || author?.bioHindi || '';
      const authorBio = stripHtml(authorBioRaw);
      const authorBioLength = authorBio.length;
      const metaDescription = entity?.meta_description ? String(entity.meta_description) : entity?.seoDescription ? String(entity.seoDescription) : '';
      const metaDescriptionLength = metaDescription.trim().length;

      const flags = {
        missing_featured_image: !featuredImageUrl,
        image_width_below_1200: featuredImageWidth > 0 && featuredImageWidth < 1200,
        missing_author: !authorName,
        empty_author_bio: author && authorBioLength === 0,
        missing_publishedAt: !publishedAt,
        meta_description_missing: metaDescriptionLength === 0,
        title_below_20_chars: title.trim().length > 0 && title.trim().length < 20,
      };

      rows.push({
        id: entity?.id ? String(entity.id) : '',
        slug,
        title,
        publishedAt,
        featuredImageUrl,
        featuredImageWidth,
        authorName,
        authorBioLength,
        metaDescriptionLength,
        issues: buildIssues(flags),
      });
    }

    if (list.length < PAGE_SIZE) break;
    start += list.length;
  }

  const outputDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `legacy-article-validation-${Date.now()}.csv`);

  const header = [
    'id',
    'slug',
    'title',
    'publishedAt',
    'featuredImageUrl',
    'featuredImageWidth',
    'authorName',
    'authorBioLength',
    'metaDescriptionLength',
    'issues',
  ];

  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.slug,
        row.title,
        row.publishedAt,
        row.featuredImageUrl,
        row.featuredImageWidth,
        row.authorName,
        row.authorBioLength,
        row.metaDescriptionLength,
        row.issues,
      ].map(csvEscape).join(','),
    );
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`Legacy validation complete. CSV saved at: ${outputPath}`);

  await strapi.destroy();
};

run().catch((error) => {
  console.error('Legacy validation failed:', error);
  process.exit(1);
});
