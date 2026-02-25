import type { Schema, Struct } from '@strapi/strapi';

export interface SeoMetadata extends Struct.ComponentSchema {
  collectionName: 'components_seo_metadata';
  info: {
    description: 'Reusable SEO fields';
    displayName: 'SEO Metadata';
  };
  attributes: {
    canonicalURL: Schema.Attribute.String;
    metaDescription: Schema.Attribute.Text &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 70;
      }>;
    ogImage: Schema.Attribute.Media<'images'>;
    structuredData: Schema.Attribute.JSON;
  };
}

export interface SharedAddress extends Struct.ComponentSchema {
  collectionName: 'components_shared_addresses';
  info: {
    displayName: 'Address';
    icon: 'pinMap';
  };
  attributes: {
    city: Schema.Attribute.String & Schema.Attribute.Required;
    cityHindi: Schema.Attribute.String;
    coordinates: Schema.Attribute.JSON;
    district: Schema.Attribute.String;
    districtHindi: Schema.Attribute.String;
    pincode: Schema.Attribute.String;
    state: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Uttar Pradesh'>;
    stateHindi: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'\u0909\u0924\u094D\u0924\u0930 \u092A\u094D\u0930\u0926\u0947\u0936'>;
    street: Schema.Attribute.String;
    streetHindi: Schema.Attribute.String;
  };
}

export interface SharedContact extends Struct.ComponentSchema {
  collectionName: 'components_shared_contacts';
  info: {
    displayName: 'Contact';
    icon: 'phone';
  };
  attributes: {
    alternatePhone: Schema.Attribute.String;
    email: Schema.Attribute.Email;
    phone: Schema.Attribute.String;
    website: Schema.Attribute.String;
    whatsapp: Schema.Attribute.String;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    canonicalUrl: Schema.Attribute.String;
    ogImage: Schema.Attribute.Media<'images'>;
    seoDescription: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    seoKeywords: Schema.Attribute.String;
    seoTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
  };
}

export interface SharedSociallinks extends Struct.ComponentSchema {
  collectionName: 'components_shared_sociallinks';
  info: {
    displayName: 'Social Links';
    icon: 'link';
  };
  attributes: {
    facebook: Schema.Attribute.String;
    instagram: Schema.Attribute.String;
    linkedin: Schema.Attribute.String;
    telegram: Schema.Attribute.String;
    twitter: Schema.Attribute.String;
    whatsapp: Schema.Attribute.String;
    youtube: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'seo.metadata': SeoMetadata;
      'shared.address': SharedAddress;
      'shared.contact': SharedContact;
      'shared.seo': SharedSeo;
      'shared.sociallinks': SharedSociallinks;
    }
  }
}
