import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);

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

function normalize(r: any): TemplateEntry {
  const price = r.price != null ? Number(r.price) : null;
  const salePrice = r.sale_price != null ? Number(r.sale_price) : null;
  const saleEndsAt = r.sale_ends_at ?? null;
  const notExpired = !saleEndsAt || new Date(saleEndsAt).getTime() > Date.now();
  const onSale = price != null && salePrice != null && salePrice < price && notExpired;
  const effectivePrice = onSale ? salePrice : price;
  const discountPct = onSale && price ? Math.round((1 - (salePrice as number) / price) * 100) : 0;
  return {
    id: r.slug,
    data: {
      title: r.title,
      cms: r.cms,
      tagline: r.tagline ?? '',
      description: r.description ?? '',
      body: r.body ?? '',
      price,
      salePrice,
      saleEndsAt,
      onSale,
      effectivePrice,
      discountPct,
      currency: r.currency ?? '€',
      status: r.status,
      featured: !!r.featured,
      order: r.sort_order ?? 100,
      cover: r.cover ?? undefined,
      preview: r.preview ?? undefined,
      previewMobile: r.preview_mobile ?? undefined,
      gallery: Array.isArray(r.gallery) ? r.gallery : [],
      features: Array.isArray(r.features) ? r.features : [],
      tags: Array.isArray(r.tags) ? r.tags : [],
      demoUrl: r.demo_url ?? undefined,
      buyUrl: r.buy_url ?? undefined,
      docsUrl: r.docs_url ?? undefined,
    },
  };
}

/** Public templates (published + coming-soon), ordered. Used at build time. */
export async function getTemplates(): Promise<TemplateEntry[]> {
  const { data, error } = await sb
    .from('hb_templates')
    .select('*')
    .in('status', ['published', 'coming-soon'])
    .order('sort_order', { ascending: true });
  if (error) { console.error('[catalog] getTemplates', error.message); return []; }
  return (data ?? []).map(normalize);
}

export async function getTemplate(slug: string): Promise<TemplateEntry | null> {
  const { data } = await sb.from('hb_templates').select('*').eq('slug', slug).maybeSingle();
  return data ? normalize(data) : null;
}
