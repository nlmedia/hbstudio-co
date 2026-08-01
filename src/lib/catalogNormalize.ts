// Pure row-mapping logic, split out of catalog.ts so it can be unit tested
// without pulling in the Supabase client (createClient() at catalog.ts's
// module scope throws outside a browser/build context that provides
// PUBLIC_SUPABASE_URL, which a plain `import` in a test file does not).
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';

export interface TemplateData {
  title: string;
  cms: 'shopify' | 'wordpress' | 'woocommerce' | 'other';
  tagline: string;
  description: string;
  body: string;
  price: number | null;
  salePrice: number | null;
  saleEndsAt: string | null;
  /** true at build time when a sale price is set, lower than price, and not past its end date */
  onSale: boolean;
  /** effective price to display/charge: salePrice when on sale, else price */
  effectivePrice: number | null;
  /** Prix du niveau Extended (5 sites), null si le niveau n'est pas proposé */
  extendedPrice: number | null;
  /** rounded discount percentage, e.g. 30 → "-30%" (0 when not on sale) */
  discountPct: number;
  currency: string;
  status: 'draft' | 'published' | 'coming-soon';
  featured: boolean;
  order: number;
  cover?: string;
  preview?: string;
  previewMobile?: string;
  gallery: string[];
  features: string[];
  tags: string[];
  demoUrl?: string;
  buyUrl?: string;
  docsUrl?: string;
}
export interface TemplateEntry { id: string; data: TemplateData; }

/**
 * Per-field French-with-English-fallback rules for the translatable template
 * content (title, tagline, description, body, features, tags). Applied here,
 * at row-normalization time, so every page that renders a template --
 * detail, card, catalogue, category -- gets the fallback for free instead of
 * re-implementing it.
 *
 * A field falls back when its French value is missing OR would otherwise
 * render as nothing useful: an empty string is not a valid translation (it
 * would show a blank where English text used to be), and an empty array is
 * not a valid translation either (it would silently wipe out a features/tags
 * list rather than translate it). The fallback is per field, never per row:
 * a template with only tagline_fr filled in shows the French tagline and the
 * English everything else.
 */
function pickText(fr: unknown, en: string): string {
  return typeof fr === 'string' && fr.trim() !== '' ? fr : en;
}

function pickList(fr: unknown, en: string[]): string[] {
  return Array.isArray(fr) && fr.length > 0 ? fr : en;
}

/**
 * Maps a raw hb_templates row to the shape the site renders, resolving the
 * translatable fields for `locale` (French with English fallback, see
 * pickText/pickList above; English is a pass-through since there is no
 * `_en` column).
 */
export function normalize(r: any, locale: Locale = DEFAULT_LOCALE): TemplateEntry {
  const price = r.price != null ? Number(r.price) : null;
  const salePrice = r.sale_price != null ? Number(r.sale_price) : null;
  const saleEndsAt = r.sale_ends_at ?? null;
  const notExpired = !saleEndsAt || new Date(saleEndsAt).getTime() > Date.now();
  const onSale = price != null && salePrice != null && salePrice < price && notExpired;
  const effectivePrice = onSale ? salePrice : price;
  const discountPct = onSale && price ? Math.round((1 - (salePrice as number) / price) * 100) : 0;
  const title = r.title ?? '';
  const tagline = r.tagline ?? '';
  const description = r.description ?? '';
  const body = r.body ?? '';
  const gallery = Array.isArray(r.gallery) ? r.gallery : [];
  const features = Array.isArray(r.features) ? r.features : [];
  const tags = Array.isArray(r.tags) ? r.tags : [];
  const fr = locale === 'fr';
  return {
    id: r.slug,
    data: {
      title: fr ? pickText(r.title_fr, title) : title,
      cms: r.cms,
      tagline: fr ? pickText(r.tagline_fr, tagline) : tagline,
      description: fr ? pickText(r.description_fr, description) : description,
      body: fr ? pickText(r.body_fr, body) : body,
      price,
      salePrice,
      saleEndsAt,
      onSale,
      effectivePrice,
      extendedPrice: r.extended_price != null ? Number(r.extended_price) : null,
      discountPct,
      currency: r.currency ?? '€',
      status: r.status,
      featured: !!r.featured,
      order: r.sort_order ?? 100,
      cover: r.cover ?? undefined,
      preview: r.preview ?? undefined,
      previewMobile: r.preview_mobile ?? undefined,
      gallery,
      features: fr ? pickList(r.features_fr, features) : features,
      tags: fr ? pickList(r.tags_fr, tags) : tags,
      demoUrl: r.demo_url ?? undefined,
      buyUrl: r.buy_url ?? undefined,
      docsUrl: r.docs_url ?? undefined,
    },
  };
}
