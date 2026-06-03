import Stripe from 'stripe';

// Server-side catalogue (amounts in cents, EUR). Edit prices here.
const CATALOG = {
  atelier:      { name: 'Atelier — Shopify theme',     amount: 16900 },
  single:       { name: 'Single license',              amount: 6900 },
  extended:     { name: 'Extended license (5 stores)', amount: 14900 },
  'all-access': { name: 'All-Access (1 year)',         amount: 29900 },
};

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
  const product = CATALOG[item];
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
