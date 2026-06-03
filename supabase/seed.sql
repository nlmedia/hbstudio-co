-- ============================================================================
-- HB Studio Co — initial data (run after schema.sql)
-- ============================================================================

-- Admin allowlist
insert into public.hb_admins (email) values ('multinlmedia@gmail.com')
on conflict (email) do nothing;

-- Atelier template (published)
insert into public.hb_templates
  (slug, title, cms, tagline, description, body, price, currency, status, featured, sort_order,
   cover, preview, preview_mobile, gallery, features, tags, demo_url, buy_url, docs_url)
values (
  'atelier', 'Atelier', 'shopify',
  'Editorial elegance for modern fashion brands.',
  'A refined, conversion-focused Shopify theme for fashion, apparel and lifestyle stores. Editorial layouts, a fast storefront, and every selling tool built in — no paid apps required. Three preset styles, four languages, fully accessible.',
  'Atelier brings the feel of a high-end fashion editorial to Shopify. Large typographic headings and warm, considered palettes meet the conversion tools shoppers expect — a slide-out cart, free-shipping bar, quick variant selection, urgency countdowns and rich product storytelling.',
  169, '€', 'published', true, 1,
  '/templates/atelier/home-hero.jpg',
  '/templates/atelier/home-full.jpg',
  '/templates/atelier/home-mobile.jpg',
  '["/templates/atelier/home-tiles.jpg","/templates/atelier/product-top.jpg","/templates/atelier/collection.jpg","/templates/atelier/cart-drawer.jpg","/templates/atelier/mega-menu.jpg","/templates/atelier/product-highlights.jpg"]'::jsonb,
  '["Editorial home with hero slideshow, shoppable lookbooks & promo video tiles","Variant-linked product gallery, swatches, size guide & highlights","Slide-out cart with AJAX add-to-cart and free-shipping progress bar","Collections with category tabs + horizontal filter bar","3 preset styles (Atelier, Noir, Botanique)","Pro mega menu, sticky header, country/currency selector","Fast & accessible — Online Store 2.0, no paid apps","Multilingual — EN · FR · ES · DE"]'::jsonb,
  '["fashion","editorial","minimal","luxury","lookbook","multilingual"]'::jsonb,
  '/demo/atelier/index.html', '#', 'https://webcomsysteme.com/hbstudio/atelier/'
)
on conflict (slug) do nothing;
