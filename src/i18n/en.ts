// English dictionary — the source of truth for the site's typed strings.
//
// This is the *only* place `Dictionary` is derived from (see `index.ts`).
// Every other locale file must satisfy the exact same shape, so adding a
// key here without translating it elsewhere is a compile-time error, not
// a silent blank string in production.
//
// Scope for now: navigation (Header) and footer strings only. The rest of
// the site's copy will be migrated in a follow-up task.
export const en = {
  nav: {
    homeAriaLabel: 'HB Studio Co — home',
    templates: 'Templates',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    agency: 'Agency',
    getTemplate: 'Get a template',
    menuAriaLabel: 'Menu',
    getInTouch: 'Get in touch',
  },
  footer: {
    tagline:
      'Premium, conversion-ready website templates for Shopify, WordPress, WooCommerce — and more platforms on the way.',
    catalogueHeading: 'Catalogue',
    allTemplates: 'All templates',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    studioHeading: 'Studio',
    about: 'About',
    contact: 'Contact',
    rights: 'All rights reserved.',
    builtBy: 'Designed & built by HB Studio Co.',
  },
};

// `typeof en` widens every string literal to `string`, so `Dictionary`
// constrains other locales to the same *shape* without forcing them to
// contain the literal English text.
export type Dictionary = typeof en;
