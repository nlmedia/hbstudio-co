import type { Dictionary } from './en';

// French dictionary. Typed against `Dictionary` (derived from `en.ts`), so
// removing or misspelling a key here fails `astro check` / `npm run build`
// with a TypeScript error instead of silently rendering an empty string.
export const fr: Dictionary = {
  nav: {
    homeAriaLabel: 'HB Studio Co — accueil',
    templates: 'Templates',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    agency: 'Agence',
    getTemplate: 'Obtenir un template',
    menuAriaLabel: 'Menu',
    getInTouch: 'Nous contacter',
  },
  footer: {
    tagline:
      'Des templates de sites premium, prêts à convertir, pour Shopify, WordPress, WooCommerce — et bientôt d’autres plateformes.',
    catalogueHeading: 'Catalogue',
    allTemplates: 'Tous les templates',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    studioHeading: 'Studio',
    about: 'À propos',
    contact: 'Contact',
    rights: 'Tous droits réservés.',
    builtBy: 'Conçu et développé par HB Studio Co.',
  },
};
