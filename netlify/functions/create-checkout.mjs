import Stripe from 'stripe';
import { getSupabase, loadSettings, pick, logError } from './_lib.mjs';
import { resolveAmount, productLabel } from './_pricing.mjs';

export const config = { path: '/api/checkout' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sb = getSupabase();
  const settings = await loadSettings(sb, ['stripe_secret_key', 'currency']);
  const key = pick(settings, 'stripe_secret_key', 'STRIPE_SECRET_KEY');
  const currency = (settings.currency || 'eur').toLowerCase();
  // Not activated yet — the front-end shows an "opens soon" message.
  if (!key) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!sb) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  let slug, tier;
  try { ({ slug, tier } = await req.json()); } catch { /* ignore */ }
  if (!slug || (tier !== 'single' && tier !== 'extended')) {
    return Response.json({ error: 'unknown_item' }, { status: 400 });
  }

  const { data: template } = await sb
    .from('hb_templates')
    .select('title, cms, price, sale_price, sale_ends_at, extended_price, status')
    .eq('slug', slug)
    .maybeSingle();

  const amount = resolveAmount(template, tier);
  if (amount == null) {
    return Response.json({ error: 'unknown_item' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://hbstudio-co.netlify.app';

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: { name: productLabel(template, tier) },
        },
      }],
      customer_creation: 'always',
      billing_address_collection: 'auto',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      metadata: { slug, tier },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    logError('checkout', err);
    // Only card errors are written for the buyer. Every other Stripe type
    // (invalid_request, authentication, api, connection) puts keys, hostnames
    // or internal config in its message — those stay in the logs.
    const message = err instanceof Stripe.errors.StripeCardError ? err.message : undefined;
    return Response.json({ error: 'stripe_error', ...(message ? { message } : {}) }, { status: 500 });
  }
};
