export function parseTemplateForm(form: FormData) {
  const str = (k: string) => String(form.get(k) ?? '').trim();
  const lines = (k: string) => str(k).split('\n').map((s) => s.trim()).filter(Boolean);
  const price = str('price');
  const salePrice = str('sale_price');
  const saleEnds = str('sale_ends_at'); // ISO string set by the form's client script
  const sort = Number(str('sort_order'));
  return {
    title: str('title'),
    slug: str('slug').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
    cms: str('cms') || 'shopify',
    status: str('status') || 'draft',
    featured: form.get('featured') === 'on',
    sort_order: Number.isFinite(sort) ? sort : 100,
    price: price === '' ? null : Number(price),
    sale_price: salePrice === '' ? null : Number(salePrice),
    sale_ends_at: saleEnds === '' ? null : saleEnds,
    tagline: str('tagline'),
    description: str('description'),
    body: str('body'),
    cover: str('cover') || null,
    preview: str('preview') || null,
    preview_mobile: str('preview_mobile') || null,
    gallery: lines('gallery'),
    features: lines('features'),
    tags: lines('tags'),
    demo_url: str('demo_url') || null,
    buy_url: str('buy_url') || null,
    docs_url: str('docs_url') || null,
    deliverable: str('deliverable') || null,
  };
}
