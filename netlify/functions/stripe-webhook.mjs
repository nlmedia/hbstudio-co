import Stripe from 'stripe';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/** Record a paid order into hb_sales (admin DB). Idempotent on the Stripe session id. */
async function recordSale(session, item, productName, email) {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return; // DB sync not configured
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  await sb.from('hb_sales').upsert({
    id: session.id,
    item: productName || item || 'unknown',
    amount: session.amount_total ?? null,
    currency: session.currency ?? 'eur',
    email: email ?? null,
    status: 'paid',
    raw: { item, payment_intent: session.payment_intent, customer: session.customer },
  }, { onConflict: 'id' });
}

// Display names for fixed license bundles (templates resolve their name from the DB).
const BUNDLE_NAMES = {
  single: 'Single license',
  extended: 'Extended license',
  'all-access': 'All-Access bundle',
};

const DOWNLOAD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const config = { path: '/api/stripe-webhook' };

function sign(item, email, exp) {
  return crypto
    .createHmac('sha256', process.env.DOWNLOAD_SECRET)
    .update(`${item}.${email}.${exp}`)
    .digest('hex');
}

/** Friendly product name: bundle map, else the template title from the DB. */
async function productName(item) {
  if (BUNDLE_NAMES[item]) return BUNDLE_NAMES[item];
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await sb.from('hb_templates').select('title').eq('slug', item).maybeSingle();
    if (data?.title) return data.title;
  }
  return item;
}

async function sendEmail(to, name, link) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'HB Studio Co <onboarding@resend.dev>';
  if (!apiKey) return; // email not configured yet
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0e0e12">
      <h1 style="font-family:Georgia,serif">Thank you for your purchase 🎉</h1>
      <p>Your <strong>${name}</strong> is ready to download.</p>
      <p><a href="${link}" style="display:inline-block;background:#0e0e12;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Download your files</a></p>
      <p style="font-size:13px;color:#6b6b73">This link is valid for 7 days. Documentation is included in the download.<br>Questions? Just reply to this email.</p>
      <p style="font-size:12px;color:#9a9aa6">— HB Studio Co</p>
    </div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `Your ${name} download`, html }),
  });
}

export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec || !process.env.DOWNLOAD_SECRET) {
    return new Response('not_configured', { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, sig, whsec);
  } catch (err) {
    return new Response(`Webhook signature error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const item = s.metadata?.item;
    const email = s.customer_details?.email || s.customer_email;
    const name = item ? await productName(item) : null;
    // Record the sale in the admin DB (independent of email delivery).
    try { await recordSale(s, item, name, email); } catch { /* logged by Netlify */ }
    if (item && email) {
      const exp = Date.now() + DOWNLOAD_TTL_MS;
      const sigv = sign(item, email, exp);
      const origin = process.env.URL || 'https://hbstudio-co.netlify.app';
      const params = new URLSearchParams({ item, email, exp: String(exp), sig: sigv });
      const link = `${origin}/api/download?${params.toString()}`;
      try { await sendEmail(email, name, link); } catch { /* logged by Netlify */ }
    }
  }

  return Response.json({ received: true });
};
