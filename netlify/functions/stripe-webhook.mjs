import Stripe from 'stripe';
import crypto from 'node:crypto';
import { getSupabase, loadSettings, pick } from './_lib.mjs';

// Display names for fixed license bundles (templates resolve their name from the DB).
const BUNDLE_NAMES = {
  single: 'Single license',
  extended: 'Extended license',
  'all-access': 'All-Access bundle',
};

export const config = { path: '/api/stripe-webhook' };

/** Record a paid order into hb_sales (admin DB). Idempotent on the Stripe session id. */
async function recordSale(sb, session, item, productName, email) {
  if (!sb) return;
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

/** Friendly product name: bundle map, else the template title from the DB. */
async function productName(sb, item) {
  if (BUNDLE_NAMES[item]) return BUNDLE_NAMES[item];
  if (sb) {
    const { data } = await sb.from('hb_templates').select('title').eq('slug', item).maybeSingle();
    if (data?.title) return data.title;
  }
  return item;
}

function sign(secret, item, email, exp) {
  return crypto.createHmac('sha256', secret).update(`${item}.${email}.${exp}`).digest('hex');
}

/** Send the download email via Brevo (single email provider for the whole app). */
async function sendDeliveryEmail(settings, to, name, link, ttlDays) {
  const apiKey = settings.brevo_api_key;
  const senderEmail = settings.sender_email;
  if (!apiKey || !senderEmail) return; // email not configured
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0e0e12">
      <h1 style="font-family:Georgia,serif">Thank you for your purchase 🎉</h1>
      <p>Your <strong>${name}</strong> is ready to download.</p>
      <p><a href="${link}" style="display:inline-block;background:#0e0e12;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Download your files</a></p>
      <p style="font-size:13px;color:#6b6b73">This link is valid for ${ttlDays} days. Documentation is included in the download.<br>Questions? Just reply to this email.</p>
      <p style="font-size:12px;color:#9a9aa6">— HB Studio Co</p>
    </div>`;
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: settings.sender_name || 'HB Studio Co', email: senderEmail },
      ...(settings.reply_to ? { replyTo: { email: settings.reply_to } } : {}),
      to: [{ email: to }],
      subject: `Your ${name} download`,
      htmlContent: html,
    }),
  });
}

export default async (req) => {
  const sb = getSupabase();
  const settings = await loadSettings(sb, [
    'stripe_secret_key', 'stripe_webhook_secret', 'download_secret', 'download_ttl_days',
    'brevo_api_key', 'sender_email', 'sender_name', 'reply_to',
  ]);
  const key = pick(settings, 'stripe_secret_key', 'STRIPE_SECRET_KEY');
  const whsec = pick(settings, 'stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET');
  const dlSecret = pick(settings, 'download_secret', 'DOWNLOAD_SECRET');
  const ttlDays = Number(settings.download_ttl_days || 7);
  if (!key || !whsec || !dlSecret) {
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
    const name = item ? await productName(sb, item) : null;
    // Record the sale in the admin DB (independent of email delivery).
    try { await recordSale(sb, s, item, name, email); } catch { /* logged by Netlify */ }
    if (item && email) {
      const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
      const sigv = sign(dlSecret, item, email, exp);
      const origin = process.env.URL || 'https://hbstudio-co.netlify.app';
      const params = new URLSearchParams({ item, email, exp: String(exp), sig: sigv });
      const link = `${origin}/api/download?${params.toString()}`;
      try { await sendDeliveryEmail(settings, email, name, link, ttlDays); } catch { /* logged by Netlify */ }
    }
  }

  return Response.json({ received: true });
};
