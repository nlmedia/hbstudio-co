export type CmsKey = 'shopify' | 'wordpress' | 'woocommerce' | 'other';

export const CMS: Record<CmsKey, {
  key: CmsKey;
  label: string;
  blurb: string;
  blurbFr: string;
  accent: string; // hex for category accents
  available: boolean;
}> = {
  shopify: {
    key: 'shopify',
    label: 'Shopify',
    blurb: 'Conversion-ready Online Store 2.0 themes.',
    blurbFr: 'Thèmes Online Store 2.0 orientés conversion.',
    accent: '#95BF47',
    available: true,
  },
  wordpress: {
    key: 'wordpress',
    label: 'WordPress',
    blurb: 'Block-native themes for content & business sites.',
    blurbFr: 'Thèmes natifs blocs pour sites de contenu & entreprise.',
    accent: '#21759B',
    available: false,
  },
  woocommerce: {
    key: 'woocommerce',
    label: 'WooCommerce',
    blurb: 'Storefronts that turn WordPress into a shop.',
    blurbFr: 'Boutiques qui transforment WordPress en e-commerce.',
    accent: '#7F54B3',
    available: false,
  },
  other: {
    key: 'other',
    label: 'More soon',
    blurb: 'Webflow, Framer, Wix & more — coming next.',
    blurbFr: 'Webflow, Framer, Wix & plus — bientôt.',
    accent: '#6d4aff',
    available: false,
  },
};

export const CMS_ORDER: CmsKey[] = ['shopify', 'wordpress', 'woocommerce', 'other'];
