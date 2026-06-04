import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Fixed license bundles (amounts in cents, EUR). Templates are priced from the DB.
const CATALOG = {
  single:       { name: 'Single license',              amount: 6900 },
  extended:     { name: 'Extended license (5 stores)', amount: 14900 },
  'all-access': { name: 'All-Access (1 year)',         amount: 29900 },
};

/** Resolve a template purchase from the DB by slug, applying an active promo. */
async function templateProduct(slug) {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: t } = await sb
    .from('hb_templates')
    .select('title, cms, price, sale_price, sale_ends_at, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!t || t.status !== 'published' || t.price == null) return null;
  const notExpired = !t.sale_ends_at || new Date(t.sale_ends_at).getTime() > Date.now();
  const onSale = t.sale_price != null && t.sale_price < t.price && notExpired;
  const eur = onSale ? Number(t.sale_price) : Number(t.price);
  return { name: `${t.title} — ${t.cms} template`, amount: Math.round(eur * 100) };
}

export const config = { path: '/api/checkout' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  // Not activated yet — the front-end shows a friendly "opens soon" message.
  if (!key) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  let item;
  try { ({ item } = await req.json()); } catch { /* ignore */ }
  // License bundles come from the static catalogue; anything else is a template slug priced from the DB.
  const product = CATALOG[item] || (item ? await templateProduct(item) : null);
  if (!product) {
    return Response.json({ error: 'unknown_item' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://hbstudio-co.netlify.app';

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.amount,
            product_data: { name: product.name },
          },
        },
      ],
      // collect email so you can deliver the files
      customer_creation: 'always',
      billing_address_collection: 'auto',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      metadata: { item },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: 'stripe_error', message: String(err?.message || err) }, { status: 500 });
  }
};
