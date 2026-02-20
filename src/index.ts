// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: any }) {
    const toNumber = (value: any): number => {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const isProduction = String(process.env.NODE_ENV || '')
      .trim()
      .toLowerCase() === 'production';
    const seedFlag = String(process.env.STRAPI_SEED ?? process.env.SEED ?? '')
      .trim()
      .toLowerCase();
    const allowSeed = !isProduction || seedFlag === '1' || seedFlag === 'true' || seedFlag === 'yes';

    const countPermissionLinks = async (roleId: number): Promise<number> => {
      const row = await strapi.db
        .connection('up_permissions_role_lnk')
        .where({ role_id: roleId })
        .count({ c: 'id' })
        .first();
      return toNumber(row?.c);
    };

    const getPermissionIdsForRole = async (roleId: number): Promise<number[]> => {
      const rows = await strapi.db
        .connection('up_permissions_role_lnk')
        .select(['permission_id'])
        .where({ role_id: roleId });
      return (rows as any[])
        .map((r) => toNumber(r?.permission_id))
        .filter((n) => n > 0);
    };

    const linkPermissionsToRole = async (roleId: number, permissionIds: number[]) => {
      if (permissionIds.length === 0) return;
      const existing = new Set(await getPermissionIdsForRole(roleId));
      const missing = permissionIds.filter((id) => id > 0 && !existing.has(id));
      if (missing.length === 0) return;
      await strapi.db
        .connection('up_permissions_role_lnk')
        .insert(missing.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
    };

    const syncDuplicateRolesByType = async (type: string) => {
      const roles = (await strapi.db
        .query('plugin::users-permissions.role')
        .findMany({ where: { type } })) as any[];
      if (!Array.isArray(roles) || roles.length <= 1) return;

      const rolesWithCounts = [];
      for (const role of roles) {
        const id = toNumber(role?.id);
        if (!id) continue;
        rolesWithCounts.push({ role, count: await countPermissionLinks(id) });
      }
      if (rolesWithCounts.length <= 1) return;

      rolesWithCounts.sort((a, b) => b.count - a.count);
      const canonicalId = toNumber(rolesWithCounts[0]?.role?.id);
      if (!canonicalId) return;

      const canonicalPermissionIds = await getPermissionIdsForRole(canonicalId);
      for (const { role } of rolesWithCounts.slice(1)) {
        const id = toNumber(role?.id);
        if (!id) continue;
        await linkPermissionsToRole(id, canonicalPermissionIds);
      }
    };

    const ensureAdminUserPermissions = async () => {
      const adminRoles = (await strapi.db
        .query('plugin::users-permissions.role')
        .findMany({ where: { type: 'admin' } })) as any[];
      if (!Array.isArray(adminRoles) || adminRoles.length === 0) return;

      const adminUserPermissionRows = await strapi.db
        .connection('up_permissions')
        .select(['id'])
        .where('action', 'like', 'api::admin-user.admin-user.%');
      const adminUserPermissionIds = (adminUserPermissionRows as any[])
        .map((r) => toNumber(r?.id))
        .filter((n) => n > 0);

      for (const role of adminRoles) {
        const id = toNumber(role?.id);
        if (!id) continue;
        await linkPermissionsToRole(id, adminUserPermissionIds);
      }
    };

    const ensureRole = async (type: string, name: string, description: string) => {
      const existing =
        (await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type } })) ??
        (await strapi.db.query('plugin::users-permissions.role').findOne({ where: { name } }));
      if (existing) return existing;
      return await strapi.db.query('plugin::users-permissions.role').create({
        data: { type, name, description },
      });
    };

    if (allowSeed) {
      await ensureRole('admin', 'Admin', 'Full access within the Admin CMS.');
      await ensureRole('editor', 'Editor', 'Can edit and publish content.');
      await ensureRole('author', 'Author', 'Can create and edit own content.');
      await ensureRole('contributor', 'Contributor', 'Can submit drafts for review.');

      await syncDuplicateRolesByType('admin');
      await syncDuplicateRolesByType('editor');
      await syncDuplicateRolesByType('author');
      await syncDuplicateRolesByType('contributor');
      await ensureAdminUserPermissions();
    }

    const allowPublicRegistration = (() => {
      const raw = String(process.env.ALLOW_PUBLIC_REGISTRATION ?? '').trim().toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'yes';
    })();
    if (isProduction && !allowPublicRegistration) {
      try {
        const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
        const advanced = await store.get({ key: 'advanced' });
        if (advanced && typeof advanced === 'object' && (advanced as any).allow_register === true) {
          await store.set({ key: 'advanced', value: { ...(advanced as any), allow_register: false } });
        }
      } catch {
        void 0;
      }
    }

    const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (bootstrapEmail && bootstrapPassword) {
      const adminRoles = (await strapi.db
        .query('plugin::users-permissions.role')
        .findMany({ where: { type: 'admin' } })) as any[];
      let adminRole: any | null = null;
      let bestCount = -1;
      if (Array.isArray(adminRoles)) {
        for (const role of adminRoles) {
          const id = toNumber(role?.id);
          if (!id) continue;
          const count = await countPermissionLinks(id);
          if (count > bestCount) {
            bestCount = count;
            adminRole = role;
          }
        }
      }
      if (adminRole?.id) {
        const userService = strapi.plugin('users-permissions').service('user');
        const existing = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({ where: { email: bootstrapEmail }, populate: ['role'] });
        if (!existing) {
          await userService.add({
            provider: 'local',
            email: bootstrapEmail,
            username: bootstrapEmail.split('@')[0] || 'admin',
            password: bootstrapPassword,
            confirmed: true,
            blocked: false,
            role: String(adminRole.id),
          });
        } else {
          const patch: Record<string, any> = {};
          if (existing?.role?.id !== adminRole.id) patch.role = String(adminRole.id);
          if (existing?.provider !== 'local') patch.provider = 'local';
          if (Object.keys(patch).length > 0) {
            await userService.edit(existing.id, patch);
          }
        }
      }
    }

    const existingCategoryCheck = (await strapi.entityService.findMany('api::category.category', {
      limit: 1,
    })) as any[];
    const existingAuthorCheck = (await strapi.entityService.findMany('api::author.author', {
      limit: 1,
    })) as any[];

    const coreSeedFlag = String(process.env.STRAPI_SEED_CORE ?? '').trim().toLowerCase();
    const forceCoreSeed = coreSeedFlag === '1' || coreSeedFlag === 'true' || coreSeedFlag === 'yes';

    const shouldSeedCore =
      allowSeed ||
      forceCoreSeed ||
      (Array.isArray(existingCategoryCheck) && existingCategoryCheck.length === 0) ||
      (Array.isArray(existingAuthorCheck) && existingAuthorCheck.length === 0);

    if (!shouldSeedCore) return;

    const seedCategories = [
      {
        slug: 'rampur',
        titleHindi: 'रामपुर',
        titleEnglish: 'Rampur News',
        description: 'रामपुर जिले से जुड़ी ताज़ा, विश्वसनीय और ज़मीनी खबरें।',
        path: '/rampur',
        order: 1,
      },
      {
        slug: 'up',
        titleHindi: 'उत्तर प्रदेश',
        titleEnglish: 'UP News',
        description: 'उत्तर प्रदेश से जुड़ी राजनीति, प्रशासन और जनहित की खबरें।',
        path: '/up',
        order: 2,
      },
      {
        slug: 'national',
        titleHindi: 'देश',
        titleEnglish: 'National',
        description: 'देशभर की महत्वपूर्ण राजनीतिक, सामाजिक और आर्थिक खबरें।',
        path: '/national',
        order: 3,
      },
      {
        slug: 'politics',
        titleHindi: 'राजनीति',
        titleEnglish: 'Politics',
        description: 'स्थानीय और राष्ट्रीय राजनीति से जुड़ी खबरें और विश्लेषण।',
        path: '/politics',
        order: 4,
      },
      {
        slug: 'crime',
        titleHindi: 'अपराध',
        titleEnglish: 'Crime',
        description: 'अपराध, कानून व्यवस्था और न्याय से जुड़ी रिपोर्ट्स।',
        path: '/crime',
        order: 5,
      },
      {
        slug: 'education-jobs',
        titleHindi: 'शिक्षा और नौकरियां',
        titleEnglish: 'Education & Jobs',
        description: 'शिक्षा, परीक्षाएं, भर्तियां और रोजगार समाचार।',
        path: '/education-jobs',
        order: 6,
      },
      {
        slug: 'business',
        titleHindi: 'व्यापार',
        titleEnglish: 'Business',
        description: 'व्यापार, अर्थव्यवस्था और स्थानीय बाजार की खबरें।',
        path: '/business',
        order: 7,
      },
      {
        slug: 'entertainment',
        titleHindi: 'मनोरंजन',
        titleEnglish: 'Entertainment',
        description: 'फिल्म, टीवी, वेब सीरीज़ और मनोरंजन जगत की खबरें।',
        path: '/entertainment',
        order: 8,
      },
      {
        slug: 'sports',
        titleHindi: 'खेल',
        titleEnglish: 'Sports',
        description: 'क्रिकेट, फुटबॉल और अन्य खेलों की ताज़ा खबरें।',
        path: '/sports',
        order: 9,
      },
      {
        slug: 'health',
        titleHindi: 'स्वास्थ्य',
        titleEnglish: 'Health',
        description: 'स्वास्थ्य, फिटनेस और चिकित्सा से जुड़ी जानकारी।',
        path: '/health',
        order: 10,
      },
      {
        slug: 'religion-culture',
        titleHindi: 'धर्म और संस्कृति',
        titleEnglish: 'Religion & Culture',
        description: 'धार्मिक, सांस्कृतिक और सामाजिक परंपराओं से जुड़ी खबरें।',
        path: '/religion-culture',
        order: 11,
      },
      {
        slug: 'food-lifestyle',
        titleHindi: 'खान-पान और लाइफस्टाइल',
        titleEnglish: 'Food & Lifestyle',
        description: 'खाने-पीने, जीवनशैली और ट्रेंड्स से जुड़ी खबरें।',
        path: '/food-lifestyle',
        order: 12,
      },
      {
        slug: 'nearby',
        titleHindi: 'आस-पास',
        titleEnglish: 'Nearby',
        description: 'रामपुर के आसपास के इलाकों की महत्वपूर्ण खबरें।',
        path: '/nearby',
        order: 13,
      },
      {
        slug: 'editorials',
        titleHindi: 'संपादकीय',
        titleEnglish: 'Editorials',
        description: 'राय, विश्लेषण और विशेष संपादकीय लेख।',
        path: '/editorials',
        order: 14,
      },
    ];

    const existing = (await strapi.entityService.findMany('api::category.category', {
      limit: 1000,
    })) as Array<any>;

    const existingBySlug = new Map<string, any>();
    for (const entity of existing) {
      if (entity?.slug) existingBySlug.set(String(entity.slug), entity);
    }

    for (const seed of seedCategories) {
      const match = existingBySlug.get(seed.slug);

      if (!match) {
        const created = await strapi.entityService.create('api::category.category', { data: seed });
        existingBySlug.set(seed.slug, created);
        continue;
      }

      const patch: Record<string, any> = {};
      if (match.titleHindi !== seed.titleHindi) patch.titleHindi = seed.titleHindi;
      if (match.titleEnglish !== seed.titleEnglish) patch.titleEnglish = seed.titleEnglish;
      if ((match.description ?? null) !== (seed.description ?? null)) patch.description = seed.description;
      if ((match.path ?? null) !== (seed.path ?? null)) patch.path = seed.path;
      if ((match.order ?? null) !== (seed.order ?? null)) patch.order = seed.order;

      if (Object.keys(patch).length > 0) {
        const updated = await strapi.entityService.update('api::category.category', match.id, {
          data: patch,
        });
        existingBySlug.set(seed.slug, updated);
      }
    }

    const seedAuthors = [
      {
        name: 'Rampur News Desk',
        nameHindi: 'रामपुर न्यूज़ डेस्क',
        email: 'desk@rampurnews.local',
        bio: 'Local reporting and editorial desk.',
        role: 'editor',
      },
      {
        name: 'Sports Desk',
        nameHindi: 'खेल डेस्क',
        email: 'sports@rampurnews.local',
        bio: 'Sports coverage and match updates.',
        role: 'author',
      },
      {
        name: 'Education Desk',
        nameHindi: 'शिक्षा डेस्क',
        email: 'education@rampurnews.local',
        bio: 'Education and jobs coverage.',
        role: 'author',
      },
    ];

    const existingAuthors = (await strapi.entityService.findMany('api::author.author', {
      limit: 1000,
    })) as Array<any>;
    const authorByEmail = new Map<string, any>();
    const authorByName = new Map<string, any>();
    for (const entity of existingAuthors) {
      if (entity?.email) authorByEmail.set(String(entity.email), entity);
      if (entity?.name) authorByName.set(String(entity.name), entity);
    }

    for (const seed of seedAuthors) {
      const match = authorByEmail.get(seed.email);
      if (!match) {
        const created = await strapi.entityService.create('api::author.author', { data: seed });
        authorByEmail.set(seed.email, created);
        if (created?.name) authorByName.set(String(created.name), created);
        continue;
      }
      const patch: Record<string, any> = {};
      if ((match.name ?? null) !== (seed.name ?? null)) patch.name = seed.name;
      if ((match.nameHindi ?? null) !== (seed.nameHindi ?? null)) patch.nameHindi = seed.nameHindi;
      if ((match.bio ?? null) !== (seed.bio ?? null)) patch.bio = seed.bio;
      if ((match.role ?? null) !== (seed.role ?? null)) patch.role = seed.role;
      if (Object.keys(patch).length > 0) {
        const updated = await strapi.entityService.update('api::author.author', match.id, { data: patch });
        authorByEmail.set(seed.email, updated);
        if (updated?.name) authorByName.set(String(updated.name), updated);
      } else {
        if (match?.name) authorByName.set(String(match.name), match);
      }
    }

    if (!allowSeed) return;

    const seedPages = [
      {
        slug: 'about',
        path: '/about',
        titleEnglish: 'About Us',
        titleHindi: 'हमारे बारे में',
        excerpt: 'About Rampur News.',
        excerptHindi: 'रामपुर न्यूज़ के बारे में।',
        content: '<p>Rampur News is a local-first digital newsroom focused on verified reporting.</p>',
        contentHindi: '<p>रामपुर न्यूज़ एक स्थानीय-प्रथम डिजिटल न्यूज़रूम है जो सत्यापित रिपोर्टिंग पर केंद्रित है।</p>',
        order: 1,
        isPublished: true,
      },
      {
        slug: 'contact',
        path: '/contact',
        titleEnglish: 'Contact Us',
        titleHindi: 'संपर्क करें',
        excerpt: 'How to reach the team.',
        excerptHindi: 'टीम से संपर्क कैसे करें।',
        content: '<p>Email: desk@rampurnews.local</p>',
        contentHindi: '<p>ईमेल: desk@rampurnews.local</p>',
        order: 2,
        isPublished: true,
      },
      {
        slug: 'privacy',
        path: '/privacy',
        titleEnglish: 'Privacy Policy',
        titleHindi: 'गोपनीयता नीति',
        excerpt: 'Privacy policy overview.',
        excerptHindi: 'गोपनीयता नीति का संक्षेप।',
        content: '<p>This is a demo privacy policy page for development.</p>',
        contentHindi: '<p>यह विकास के लिए एक डेमो गोपनीयता नीति पेज है।</p>',
        order: 3,
        isPublished: true,
      },
      {
        slug: 'terms',
        path: '/terms',
        titleEnglish: 'Terms and Conditions',
        titleHindi: 'नियम और शर्तें',
        excerpt: 'Terms of use.',
        excerptHindi: 'उपयोग की शर्तें।',
        content: '<p>This is a demo terms page for development.</p>',
        contentHindi: '<p>यह विकास के लिए एक डेमो नियम पेज है।</p>',
        order: 4,
        isPublished: true,
      },
      {
        slug: 'ownership',
        path: '/ownership',
        titleEnglish: 'Ownership and Financial Disclosure',
        titleHindi: 'स्वामित्व और वित्तीय प्रकटीकरण',
        excerpt: 'Ownership disclosure.',
        excerptHindi: 'स्वामित्व प्रकटीकरण।',
        content: '<p>This is a demo ownership disclosure page for development.</p>',
        contentHindi: '<p>यह विकास के लिए एक डेमो स्वामित्व प्रकटीकरण पेज है।</p>',
        order: 5,
        isPublished: true,
      },
      {
        slug: 'grievance',
        path: '/grievance',
        titleEnglish: 'Grievance Redressal',
        titleHindi: 'शिकायत निवारण नीति',
        excerpt: 'Grievance redressal policy.',
        excerptHindi: 'शिकायत निवारण नीति।',
        content: '<p>This is a demo grievance page for development.</p>',
        contentHindi: '<p>यह विकास के लिए एक डेमो शिकायत पेज है।</p>',
        order: 6,
        isPublished: true,
      },
      {
        slug: 'disclaimer',
        path: '/disclaimer',
        titleEnglish: 'Disclaimer',
        titleHindi: 'अस्वीकरण',
        excerpt: 'Disclaimer.',
        excerptHindi: 'अस्वीकरण।',
        content: '<p>This is a demo disclaimer page for development.</p>',
        contentHindi: '<p>यह विकास के लिए एक डेमो अस्वीकरण पेज है।</p>',
        order: 7,
        isPublished: true,
      },
    ];

    const existingPages = (await strapi.entityService.findMany('api::page.page', {
      limit: 1000,
    })) as Array<any>;
    const pageBySlug = new Map<string, any>();
    for (const entity of existingPages) {
      if (entity?.slug) pageBySlug.set(String(entity.slug), entity);
    }
    for (const seed of seedPages) {
      const match = pageBySlug.get(seed.slug);
      if (!match) {
        const created = await strapi.entityService.create('api::page.page', { data: seed });
        pageBySlug.set(seed.slug, created);
        continue;
      }
      const patch: Record<string, any> = {};
      for (const key of Object.keys(seed)) {
        if ((match as any)[key] !== (seed as any)[key]) patch[key] = (seed as any)[key];
      }
      if (Object.keys(patch).length > 0) {
        const updated = await strapi.entityService.update('api::page.page', match.id, { data: patch });
        pageBySlug.set(seed.slug, updated);
      }
    }

    const categoryHindiBySlug = new Map<string, string>();
    for (const c of seedCategories) categoryHindiBySlug.set(c.slug, c.titleHindi);

    const existingArticles = (await strapi.entityService.findMany('api::article.article', {
      limit: 5000,
    })) as Array<any>;
    const articleBySlug = new Map<string, any>();
    const articlesBySlug = new Map<string, any[]>();
    for (const entity of existingArticles) {
      if (!entity?.slug) continue;
      const slug = String(entity.slug);
      articleBySlug.set(slug, entity);
      const bucket = articlesBySlug.get(slug) ?? [];
      bucket.push(entity);
      articlesBySlug.set(slug, bucket);
    }
    for (const [slug, entities] of articlesBySlug.entries()) {
      if (entities.length <= 1) continue;
      const [keep, ...duplicates] = entities;
      for (const dupe of duplicates) {
        try {
          await strapi.entityService.delete('api::article.article', dupe.id);
        } catch (error) {
          void error;
        }
      }
      if (keep) {
        articleBySlug.set(slug, keep);
      }
    }

    const now = new Date();
    const placeholder = (text: string) =>
      `https://via.placeholder.com/1200x630.png?text=${encodeURIComponent(text)}`;

    const existingTags = (await strapi.entityService.findMany('api::tag.tag', {
      limit: 1000,
    })) as Array<any>;
    const tagByName = new Map<string, any>();
    for (const entity of existingTags) {
      if (entity?.name) tagByName.set(String(entity.name), entity);
      if (entity?.slug) tagByName.set(String(entity.slug), entity);
    }

    const slugify = (value: string) => {
      const slug = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      return slug || `tag-${Date.now()}`;
    };

    const ensureTag = async (name: string) => {
      const existing = tagByName.get(name);
      if (existing) return existing;
      const created = await strapi.entityService.create('api::tag.tag', { data: { name, slug: slugify(name) } });
      tagByName.set(name, created);
      if (created?.slug) tagByName.set(String(created.slug), created);
      return created;
    };

    const demoArticles = seedCategories.flatMap((cat) => {
      return [
        {
          title: `${cat.titleEnglish} Demo Story 1`,
          slug: `${cat.slug}-demo-1`,
          excerpt: `Demo excerpt for ${cat.titleEnglish} story 1.`,
          content: `<p>This is demo content for ${cat.titleEnglish} (1).</p>`,
          isFeatured: cat.slug === 'rampur',
          isBreaking: cat.slug === 'up',
          views: 100,
          readTime: '3 min',
          seoTitle: `${cat.titleEnglish} Demo Story 1`,
          seoDescription: `Demo SEO description for ${cat.titleEnglish} story 1.`,
          videoType: 'none',
          categorySlug: cat.slug,
          authorName:
            cat.slug === 'sports'
              ? 'Sports Desk'
              : cat.slug === 'education-jobs'
                ? 'Education Desk'
                : 'Rampur News Desk',
          tagNames: ['demo', cat.slug],
        },
        {
          title: `${cat.titleEnglish} Demo Story 2`,
          slug: `${cat.slug}-demo-2`,
          excerpt: `Demo excerpt for ${cat.titleEnglish} story 2.`,
          content: `<p>This is demo content for ${cat.titleEnglish} (2).</p>`,
          isFeatured: false,
          isBreaking: false,
          views: 100,
          readTime: '3 min',
          seoTitle: `${cat.titleEnglish} Demo Story 2`,
          seoDescription: `Demo SEO description for ${cat.titleEnglish} story 2.`,
          videoType: 'none',
          categorySlug: cat.slug,
          authorName:
            cat.slug === 'sports'
              ? 'Sports Desk'
              : cat.slug === 'education-jobs'
                ? 'Education Desk'
                : 'Rampur News Desk',
          tagNames: ['demo', cat.slug],
        },
      ];
    });

    for (const seed of demoArticles) {
      const match = articleBySlug.get(seed.slug);
      const categoryEntity = existingBySlug.get(seed.categorySlug);
      const authorEntity = authorByName.get(seed.authorName);
      if (!categoryEntity || !authorEntity) continue;

      const tagEntities = await Promise.all((seed.tagNames ?? []).map((t: string) => ensureTag(t)));
      const tagIds = tagEntities.map((t: any) => t?.id).filter(Boolean);

      const data = {
        title: seed.title,
        slug: seed.slug,
        excerpt: seed.excerpt,
        content: seed.content,
        isFeatured: seed.isFeatured,
        isBreaking: seed.isBreaking,
        views: seed.views,
        readTime: seed.readTime,
        seoTitle: seed.seoTitle,
        seoDescription: seed.seoDescription,
        videoType: seed.videoType,
        category: categoryEntity.id,
        author: authorEntity.id,
        tags: tagIds,
      };

      if (!match) {
        try {
          const created = await strapi.entityService.create('api::article.article', { data });
          articleBySlug.set(seed.slug, created);
        } catch (error) {
          void error;
        }
        continue;
      }
      try {
        const updated = await strapi.entityService.update('api::article.article', match.id, { data });
        articleBySlug.set(seed.slug, updated);
      } catch (error) {
        void error;
      }
    }

    const existingMicrositeItems = (await strapi.entityService.findMany('api::microsite-item.microsite-item', {
      limit: 5000,
    })) as Array<any>;
    const micrositeBySlug = new Map<string, any>();
    for (const entity of existingMicrositeItems) {
      if (entity?.slug) micrositeBySlug.set(String(entity.slug), entity);
    }

    const d = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

    const micrositeSeeds: Array<{ type: string; slug: string; payload: any; order: number }> = [
      {
        type: 'exam',
        slug: 'exam-up-board-2026-demo',
        order: 1,
        payload: {
          title: 'UP Board Exam 2026',
          titleHindi: 'यूपी बोर्ड परीक्षा 2026',
          slug: 'exam-up-board-2026-demo',
          examDate: d(45),
          organization: 'UPMSP',
          organizationHindi: 'यूपीएमएसपी',
          category: 'board',
          description: 'Board exam schedule and important instructions.',
          status: 'upcoming',
          applicationStatus: 'open',
          admitCardStatus: 'upcoming',
          resultStatus: 'not-declared',
          image: placeholder('Exam 2026'),
          descriptionHindi: 'परीक्षा कार्यक्रम और आवश्यक निर्देश।',
          lastUpdated: now.toISOString(),
          isFeatured: true,
        },
      },
      {
        type: 'result',
        slug: 'result-up-board-2025-demo',
        order: 2,
        payload: {
          title: 'UP Board Result 2025',
          titleHindi: 'यूपी बोर्ड परिणाम 2025',
          slug: 'result-up-board-2025-demo',
          resultDate: d(-10),
          organization: 'UPMSP',
          organizationHindi: 'यूपीएमएसपी',
          category: 'board',
          description: 'Result announcement details and official links.',
          descriptionHindi: 'परिणाम घोषणा और आधिकारिक लिंक।',
          status: 'declared',
          resultLink: 'https://example.com/results',
          image: placeholder('Result 2025'),
          lastUpdated: now.toISOString(),
          isFeatured: true,
        },
      },
      {
        type: 'institution',
        slug: 'institution-demo-college-rampur',
        order: 3,
        payload: {
          name: 'Rampur City College',
          nameHindi: 'रामपुर सिटी कॉलेज',
          slug: 'institution-demo-college-rampur',
          type: 'college',
          address: 'Main Road, Rampur',
          addressHindi: 'मेन रोड, रामपुर',
          city: 'Rampur',
          district: 'Rampur',
          state: 'Uttar Pradesh',
          pincode: '244901',
          phone: '+91-00000-00000',
          website: 'https://example.com/college',
          description: 'A demo institution profile with courses and facilities.',
          descriptionHindi: 'कोर्स और सुविधाओं के साथ डेमो संस्थान प्रोफाइल।',
          courses: ['BA', 'BSc', 'BCom'],
          coursesHindi: ['बीए', 'बीएससी', 'बीकॉम'],
          facilities: ['Library', 'Hostel', 'Sports Ground'],
          facilitiesHindi: ['पुस्तकालय', 'हॉस्टल', 'खेल मैदान'],
          image: placeholder('College'),
          isFeatured: true,
        },
      },
      {
        type: 'holiday',
        slug: 'holiday-demo-republic-day',
        order: 4,
        payload: {
          name: 'Republic Day',
          nameHindi: 'गणतंत्र दिवस',
          slug: 'holiday-demo-republic-day',
          date: d(4),
          type: 'national',
          description: 'National holiday observed across India.',
          descriptionHindi: 'भारत भर में मनाया जाने वाला राष्ट्रीय अवकाश।',
          isRecurring: true,
          isPublicHoliday: true,
          image: placeholder('Holiday'),
        },
      },
      {
        type: 'restaurant',
        slug: 'restaurant-demo-old-city-kitchen',
        order: 5,
        payload: {
          name: 'Old City Kitchen',
          nameHindi: 'ओल्ड सिटी किचन',
          slug: 'restaurant-demo-old-city-kitchen',
          type: 'restaurant',
          cuisine: ['North Indian', 'Mughlai'],
          address: 'Civil Lines, Rampur',
          addressHindi: 'सिविल लाइंस, रामपुर',
          city: 'Rampur',
          district: 'Rampur',
          phone: '+91-00000-00001',
          priceRange: 'moderate',
          rating: 4.3,
          reviews: 120,
          openingHours: '10:00 AM - 10:30 PM',
          description: 'Demo restaurant listing with menu highlights.',
          descriptionHindi: 'मेन्यू हाइलाइट्स के साथ डेमो रेस्तरां लिस्टिंग।',
          isVeg: false,
          hasDelivery: true,
          isFeatured: true,
          image: placeholder('Restaurant'),
          mapLink: 'https://maps.google.com',
        },
      },
      {
        type: 'fashion-store',
        slug: 'fashion-demo-style-hub',
        order: 6,
        payload: {
          name: 'Style Hub',
          nameHindi: 'स्टाइल हब',
          slug: 'fashion-demo-style-hub',
          type: 'boutique',
          category: 'women',
          address: 'Station Road, Rampur',
          addressHindi: 'स्टेशन रोड, रामपुर',
          city: 'Rampur',
          district: 'Rampur',
          phone: '+91-00000-00002',
          priceRange: 'moderate',
          rating: 4.1,
          brands: ['Brand A', 'Brand B'],
          specialties: ['Ethnic Wear', 'Sarees'],
          specialtiesHindi: ['एथनिक वियर', 'साड़ी'],
          description: 'Demo fashion store listing.',
          descriptionHindi: 'डेमो फैशन स्टोर लिस्टिंग।',
          isFeatured: true,
          image: placeholder('Fashion'),
        },
      },
      {
        type: 'shopping-centre',
        slug: 'shopping-demo-central-market',
        order: 7,
        payload: {
          name: 'Central Market',
          nameHindi: 'सेंट्रल मार्केट',
          slug: 'shopping-demo-central-market',
          type: 'market',
          address: 'Market Area, Rampur',
          addressHindi: 'मार्केट एरिया, रामपुर',
          city: 'Rampur',
          district: 'Rampur',
          phone: '+91-00000-00003',
          openingHours: '09:00 AM - 09:00 PM',
          storeCount: 180,
          amenities: ['Parking', 'Food Court'],
          amenitiesHindi: ['पार्किंग', 'फूड कोर्ट'],
          parkingAvailable: true,
          description: 'Demo shopping centre listing.',
          descriptionHindi: 'डेमो शॉपिंग सेंटर लिस्टिंग।',
          isFeatured: true,
          image: placeholder('Shopping'),
          mapLink: 'https://maps.google.com',
        },
      },
      {
        type: 'famous-place',
        slug: 'place-demo-rampur-fort',
        order: 8,
        payload: {
          name: 'Rampur Fort',
          nameHindi: 'रामपुर किला',
          slug: 'place-demo-rampur-fort',
          type: 'historical',
          address: 'Old City, Rampur',
          addressHindi: 'ओल्ड सिटी, रामपुर',
          city: 'Rampur',
          district: 'Rampur',
          description: 'A demo historical landmark listing.',
          descriptionHindi: 'डेमो ऐतिहासिक स्थल लिस्टिंग।',
          history: 'Built in the late 18th century (demo).',
          historyHindi: 'अठारहवीं शताब्दी के अंत में निर्मित (डेमो)।',
          timings: '10:00 AM - 05:00 PM',
          entryFee: 'Free',
          bestTimeToVisit: 'Winter',
          rating: 4.5,
          isFeatured: true,
          image: placeholder('Place'),
        },
      },
      {
        type: 'event',
        slug: 'event-demo-cultural-fest',
        order: 9,
        payload: {
          title: 'Rampur Cultural Fest',
          titleHindi: 'रामपुर सांस्कृतिक उत्सव',
          slug: 'event-demo-cultural-fest',
          date: d(12),
          time: '06:00 PM',
          venue: 'Town Hall',
          venueHindi: 'टाउन हॉल',
          address: 'Town Hall Road, Rampur',
          city: 'Rampur',
          district: 'Rampur',
          category: 'cultural',
          organizer: 'Local Committee',
          organizerHindi: 'स्थानीय समिति',
          description: 'Demo upcoming cultural event.',
          descriptionHindi: 'डेमो आगामी सांस्कृतिक कार्यक्रम।',
          image: placeholder('Event'),
          ticketPrice: '₹100',
          isFree: false,
          isFeatured: true,
          status: 'upcoming',
          registrationLink: 'https://example.com/register',
        },
      },
      {
        type: 'exam',
        slug: 'exam-ssc-cgl-2026-demo',
        order: 10,
        payload: {
          title: 'SSC CGL 2026',
          titleHindi: 'एसएससी सीजीएल 2026',
          slug: 'exam-ssc-cgl-2026-demo',
          examDate: d(90),
          applicationStartDate: d(20),
          applicationEndDate: d(55),
          admitCardDate: d(80),
          organization: 'SSC',
          organizationHindi: 'एसएससी',
          category: 'competitive',
          subcategory: 'cgl',
          description: 'Application dates, eligibility and exam pattern (demo).',
          descriptionHindi: 'आवेदन तिथि, पात्रता और परीक्षा पैटर्न (डेमो)।',
          eligibility: 'Graduation (demo)',
          eligibilityHindi: 'स्नातक (डेमो)',
          officialWebsite: 'https://ssc.nic.in',
          applicationLink: 'https://ssc.nic.in/apply',
          status: 'upcoming',
          applicationStatus: 'upcoming',
          admitCardStatus: 'upcoming',
          resultStatus: 'not-declared',
          isPopular: true,
          isFeatured: false,
          image: placeholder('SSC CGL'),
          lastUpdated: now.toISOString(),
        },
      },
      {
        type: 'exam',
        slug: 'exam-up-police-constable-2026-demo',
        order: 11,
        payload: {
          title: 'UP Police Constable Recruitment 2026',
          titleHindi: 'यूपी पुलिस कांस्टेबल भर्ती 2026',
          slug: 'exam-up-police-constable-2026-demo',
          examDate: d(35),
          applicationStartDate: d(-5),
          applicationEndDate: d(10),
          organization: 'UPPRPB',
          organizationHindi: 'यूपीपीआरपीबी',
          category: 'government',
          description: 'Recruitment notification highlights and important dates (demo).',
          descriptionHindi: 'भर्ती अधिसूचना सारांश और महत्वपूर्ण तिथियाँ (डेमो)।',
          totalPosts: 60244,
          status: 'ongoing',
          applicationStatus: 'open',
          admitCardStatus: 'not-released',
          resultStatus: 'not-declared',
          isPopular: true,
          image: placeholder('UP Police'),
          lastUpdated: now.toISOString(),
        },
      },
      {
        type: 'result',
        slug: 'result-ssc-mts-2025-demo',
        order: 12,
        payload: {
          title: 'SSC MTS Result 2025',
          titleHindi: 'एसएससी एमटीएस परिणाम 2025',
          slug: 'result-ssc-mts-2025-demo',
          resultDate: d(-3),
          organization: 'SSC',
          organizationHindi: 'एसएससी',
          category: 'competitive',
          description: 'Result declared with merit list and cut-off details (demo).',
          descriptionHindi: 'मेरिट लिस्ट और कट-ऑफ विवरण के साथ परिणाम घोषित (डेमो)।',
          resultLink: 'https://ssc.nic.in/results',
          passPercentage: 32.5,
          cutoffMarks: 'UR: 135, OBC: 128 (demo)',
          status: 'declared',
          isNew: true,
          isFeatured: false,
          image: placeholder('MTS Result'),
          lastUpdated: now.toISOString(),
        },
      },
      {
        type: 'result',
        slug: 'result-up-scholarship-2026-demo',
        order: 13,
        payload: {
          title: 'UP Scholarship Status 2026',
          titleHindi: 'यूपी स्कॉलरशिप स्टेटस 2026',
          slug: 'result-up-scholarship-2026-demo',
          resultDate: d(25),
          expectedDate: d(20),
          organization: 'UP Social Welfare',
          organizationHindi: 'यूपी समाज कल्याण',
          category: 'government',
          description: 'Expected release window and how to check status (demo).',
          descriptionHindi: 'अपेक्षित तिथि और स्टेटस कैसे चेक करें (डेमो)।',
          status: 'expected',
          isFeatured: true,
          image: placeholder('Scholarship'),
          lastUpdated: now.toISOString(),
        },
      },
      {
        type: 'event',
        slug: 'event-demo-job-fair-2026',
        order: 14,
        payload: {
          title: 'Rampur Job Fair 2026',
          titleHindi: 'रामपुर जॉब फेयर 2026',
          slug: 'event-demo-job-fair-2026',
          date: d(30),
          time: '11:00 AM',
          venue: 'District Stadium',
          venueHindi: 'जिला स्टेडियम',
          address: 'Stadium Road, Rampur',
          city: 'Rampur',
          district: 'Rampur',
          category: 'business',
          organizer: 'District Administration',
          organizerHindi: 'जिला प्रशासन',
          description: 'Demo hiring drive with multiple employers.',
          descriptionHindi: 'कई नियोक्ताओं के साथ डेमो हायरिंग ड्राइव।',
          image: placeholder('Job Fair'),
          isFree: true,
          isFeatured: true,
          status: 'upcoming',
          registrationLink: 'https://example.com/job-fair',
        },
      },
    ];

    const moduleTypes = new Set([
      'exam',
      'result',
      'institution',
      'holiday',
      'restaurant',
      'fashion-store',
      'shopping-centre',
      'famous-place',
      'event',
    ]);

    const pickIndexFields = (moduleType: string, value: any) => {
      const title = value?.title ?? value?.name ?? undefined;
      const titleHindi = value?.titleHindi ?? value?.nameHindi ?? undefined;
      const name = value?.name ?? undefined;
      const nameHindi = value?.nameHindi ?? undefined;
      const subtype = typeof value?.type === 'string' && !moduleTypes.has(value.type) ? value.type : undefined;
      const category = value?.category ?? subtype ?? undefined;
      const subcategory = value?.subcategory ?? (value?.category && subtype ? subtype : undefined);
      const status = value?.status ?? undefined;
      const city = value?.city ?? undefined;
      const district = value?.district ?? undefined;
      const featured = value?.isFeatured ?? value?.featured ?? undefined;
      const popular = value?.isPopular ?? value?.popular ?? undefined;
      const image = value?.image ?? undefined;
      const order = value?.order ?? undefined;
      const date = value?.examDate ?? value?.resultDate ?? value?.date ?? value?.publishedAt ?? undefined;
      const endDate = value?.endDate ?? undefined;
      return {
        type: moduleType,
        slug: value?.slug,
        title,
        titleHindi,
        name,
        nameHindi,
        category,
        subcategory,
        status,
        city,
        district,
        date,
        endDate,
        featured,
        popular,
        image,
        order,
      };
    };

    for (const seed of micrositeSeeds) {
      const seedSlug = seed.slug ?? seed.payload?.slug;
      if (!seedSlug) throw new Error('Microsite seed is missing slug');
      const match = micrositeBySlug.get(seedSlug);
      const payload = { ...seed.payload, slug: seedSlug, order: seed.order };
      const index = pickIndexFields(seed.type, payload);
      const data = { ...index, slug: seedSlug, order: seed.order, payload };

      if (!match) {
        const created = await strapi.entityService.create('api::microsite-item.microsite-item', { data });
        micrositeBySlug.set(seedSlug, created);
        continue;
      }

      const patch: Record<string, any> = {};
      for (const key of Object.keys(data)) {
        const next = (data as any)[key];
        const prev = (match as any)[key];
        if (key === 'payload') {
          if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) patch.payload = next;
          continue;
        }
        if ((prev ?? null) !== (next ?? null)) patch[key] = next;
      }
      if (Object.keys(patch).length > 0) {
        const updated = await strapi.entityService.update('api::microsite-item.microsite-item', match.id, {
          data: patch,
        });
        micrositeBySlug.set(seedSlug, updated);
      }
    }
  },
};
