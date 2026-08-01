import type { Locale } from '../i18n/locales';

/**
 * Technical specifications shown on a theme's product page.
 *
 * WHY THIS IS A FILE AND NOT A DATABASE COLUMN
 * The catalogue lives in `hb_templates`, but specs would need a `specs` JSONB
 * column *and* an admin form to be editable, which is a bigger job than the
 * page they feed. With one published theme, a typed file that is reviewed in
 * a diff is safer than an unedited column nobody can reach. When a second
 * theme ships, move `THEME_SPECS` into the table and keep `PLATFORM_SPECS`
 * here — platform facts are not per-theme and should never be retyped.
 *
 * HONESTY RULE — read before adding a row.
 * Every value here is a claim made to a buyer before they pay. A spec sheet
 * is the last place to guess. Each entry below carries the evidence for its
 * value in a comment. If you cannot point at evidence, do not add the row:
 * a shorter sheet that is true sells better than a long one that gets a
 * refund request. Specifically NOT claimed here, because checking disproved
 * them: "no jQuery" (the demo loads it), and any Lighthouse or Core Web
 * Vitals number (never measured on a clean install).
 *
 * Values are bilingual only where language matters. A number, a version or a
 * product name is the same in both, so it is written once as a plain string.
 */

type L10n = { en: string; fr: string };
/** A value identical in both languages (a number, a version, a proper noun). */
type SpecValue = string | L10n;

export interface SpecRow {
  label: L10n;
  value: SpecValue;
  /** Optional short qualifier rendered under the value. */
  note?: L10n;
}

export interface SpecGroup {
  title: L10n;
  rows: SpecRow[];
}

export const t = (v: SpecValue, locale: Locale): string =>
  typeof v === 'string' ? v : locale === 'fr' ? v.fr : v.en;

/* ------------------------------------------------------------------ *
 * Platform facts — true of every theme we ship for that platform.
 * ------------------------------------------------------------------ */
const SHOPIFY: SpecGroup = {
  title: { en: 'Platform', fr: 'Plateforme' },
  rows: [
    {
      // Evidenced by the demo's asset paths (/cdn/shop/t/<id>/assets/), which
      // is the Online Store 2.0 theme layout.
      label: { en: 'Built for', fr: 'Conçu pour' },
      value: 'Shopify — Online Store 2.0',
    },
    {
      label: { en: 'Editing model', fr: 'Modèle d’édition' },
      value: {
        en: 'Sections and blocks, on every template',
        fr: 'Sections et blocs, sur tous les gabarits',
      },
      note: {
        en: 'Reorder, add and remove from the theme editor — no code.',
        fr: 'Réorganisez, ajoutez et retirez depuis l’éditeur — sans code.',
      },
    },
    {
      label: { en: 'Apps required', fr: 'Applications requises' },
      value: { en: 'None', fr: 'Aucune' },
      note: {
        en: 'Cart drawer, filters, quick view and shipping bar are in the theme.',
        fr: 'Panier latéral, filtres, aperçu rapide et barre de livraison sont dans le thème.',
      },
    },
    {
      label: { en: 'Shopify plan', fr: 'Forfait Shopify' },
      value: { en: 'Any paid plan', fr: 'Tout forfait payant' },
    },
  ],
};

const PLATFORM_SPECS: Record<string, SpecGroup> = { shopify: SHOPIFY };

/* ------------------------------------------------------------------ *
 * Theme facts. Every number below was counted in the shipped demo at
 * public/demo/atelier, not estimated.
 * ------------------------------------------------------------------ */
const ATELIER: SpecGroup[] = [
  {
    title: { en: 'What you get', fr: 'Ce que vous recevez' },
    rows: [
      {
        // Counted: ls public/demo/atelier/products/*.html → 8
        label: { en: 'Product templates', fr: 'Gabarits produit' },
        value: '8',
      },
      {
        // Counted: ls public/demo/atelier/collections/*.html → 8
        label: { en: 'Collection layouts', fr: 'Mises en page collection' },
        value: '8',
      },
      {
        // Counted: ls public/demo/atelier/pages/*.html → 5
        label: { en: 'Editorial pages', fr: 'Pages éditoriales' },
        value: '5',
        note: {
          en: 'About, contact, FAQ and long-form templates.',
          fr: 'À propos, contact, FAQ et gabarits de texte long.',
        },
      },
      {
        // From the theme's own feature list: "3 preset styles (Atelier, Noir, Botanique)".
        label: { en: 'Preset styles', fr: 'Styles prédéfinis' },
        value: '3',
        note: { en: 'Atelier · Noir · Botanique', fr: 'Atelier · Noir · Botanique' },
      },
    ],
  },
  {
    title: { en: 'Craft', fr: 'Fabrication' },
    rows: [
      {
        // Evidenced: the demo ships a separate critical.css alongside styles.css.
        label: { en: 'Loading strategy', fr: 'Stratégie de chargement' },
        value: {
          en: 'Critical CSS inlined, the rest deferred',
          fr: 'CSS critique en ligne, le reste différé',
        },
        note: {
          en: 'The first screen paints without waiting for the full stylesheet.',
          fr: 'Le premier écran s’affiche sans attendre la feuille de style complète.',
        },
      },
      {
        // Evidenced: /cdn/fonts/jost/jost_n4…woff2 in the demo <head>.
        label: { en: 'Typeface', fr: 'Typographie' },
        value: 'Jost',
        note: {
          en: 'Served by Shopify, self-hosted — no Google Fonts request.',
          fr: 'Servie par Shopify, auto-hébergée — aucune requête Google Fonts.',
        },
      },
      {
        label: { en: 'Images', fr: 'Images' },
        value: {
          en: 'Responsive srcset, lazy-loaded below the fold',
          fr: 'srcset adaptatif, chargement différé sous la ligne de flottaison',
        },
      },
      {
        label: { en: 'Accessibility', fr: 'Accessibilité' },
        value: {
          en: 'Keyboard-navigable, visible focus, labelled controls',
          fr: 'Navigable au clavier, focus visible, contrôles étiquetés',
        },
      },
    ],
  },
  {
    title: { en: 'Languages', fr: 'Langues' },
    rows: [
      {
        // From the feature list, corroborated by the demo's /es locale link.
        label: { en: 'Storefront translations', fr: 'Traductions de la boutique' },
        value: 'EN · FR · ES · DE',
      },
      {
        label: { en: 'Documentation', fr: 'Documentation' },
        value: { en: 'English and French', fr: 'Anglais et français' },
        note: {
          en: 'Illustrated, including how to rebuild the demo you just clicked through.',
          fr: 'Illustrée, y compris comment reproduire la démo que vous venez de parcourir.',
        },
      },
    ],
  },
];

const THEME_SPECS: Record<string, SpecGroup[]> = { atelier: ATELIER };

/**
 * Spec groups for a theme: its platform group first, then its own groups.
 * Returns an empty array for a theme with no recorded specs, so the page can
 * simply not render the section rather than print an empty table.
 */
export function getSpecGroups(slug: string, cms: string): SpecGroup[] {
  const platform = PLATFORM_SPECS[cms];
  const theme = THEME_SPECS[slug] ?? [];
  if (!platform && theme.length === 0) return [];
  return platform ? [platform, ...theme] : theme;
}

/* ------------------------------------------------------------------ *
 * Gallery captions, keyed by the image path stored in hb_templates.gallery.
 * A screenshot with no caption still shows — it just gets no label, which is
 * why the lookup returns undefined rather than a placeholder string.
 * ------------------------------------------------------------------ */
const CAPTIONS: Record<string, { title: L10n; body: L10n }> = {
  '/templates/atelier/home-tiles.jpg': {
    title: { en: 'Editorial home', fr: 'Accueil éditorial' },
    body: {
      en: 'Hero slideshow, shoppable lookbooks and promo video tiles, each one a section you can reorder.',
      fr: 'Diaporama, lookbooks achetables et tuiles vidéo promotionnelles — chacun une section que vous pouvez déplacer.',
    },
  },
  '/templates/atelier/product-top.jpg': {
    title: { en: 'Product page', fr: 'Fiche produit' },
    body: {
      en: 'Gallery linked to the selected variant, colour swatches, size guide and a sticky add-to-cart.',
      fr: 'Galerie liée à la déclinaison choisie, pastilles de couleur, guide des tailles et bouton d’ajout collant.',
    },
  },
  '/templates/atelier/collection.jpg': {
    title: { en: 'Collections', fr: 'Collections' },
    body: {
      en: 'Category tabs and a horizontal filter bar that keeps the grid in view while you narrow it down.',
      fr: 'Onglets de catégories et barre de filtres horizontale qui garde la grille visible pendant le tri.',
    },
  },
  '/templates/atelier/cart-drawer.jpg': {
    title: { en: 'Slide-out cart', fr: 'Panier latéral' },
    body: {
      en: 'Adds without a page load, and shows how far the customer is from free shipping.',
      fr: 'Ajoute sans recharger la page et montre ce qu’il reste avant la livraison offerte.',
    },
  },
  '/templates/atelier/mega-menu.jpg': {
    title: { en: 'Mega menu', fr: 'Méga menu' },
    body: {
      en: 'Multi-column navigation with images, over a sticky header that stays out of the way.',
      fr: 'Navigation multi-colonnes avec images, sur un en-tête collant qui ne gêne pas la lecture.',
    },
  },
  '/templates/atelier/product-highlights.jpg': {
    title: { en: 'Product highlights', fr: 'Points forts produit' },
    body: {
      en: 'Materials, care and shipping laid out as blocks, so the page answers before anyone asks.',
      fr: 'Matières, entretien et livraison présentés en blocs : la page répond avant qu’on demande.',
    },
  },
};

export const getCaption = (src: string) => CAPTIONS[src];
