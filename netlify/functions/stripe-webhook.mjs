import Stripe from 'stripe';
import crypto from 'node:crypto';
import { getSupabase, loadSettings, pick, logError } from './_lib.mjs';
import { createLicenseForSale } from './_licensing.mjs';

export const config = { path: '/api/stripe-webhook' };

/** Record a paid order into hb_sales (admin DB). Idempotent on the Stripe session id. */
async function recordSale(sb, session, slug, productName, email) {
  if (!sb) return;
  await sb.from('hb_sales').upsert({
    id: session.id,
    // hb_sales.item is the DB column name (read by src/pages/admin/index.astro
    // and src/pages/admin/sales.astro) -- it stays "item", only its source changes.
    item: productName || slug || 'unknown',
    amount: session.amount_total ?? null,
    currency: session.currency ?? 'eur',
    email: email ?? null,
    status: 'paid',
    raw: { slug, payment_intent: session.payment_intent, customer: session.customer },
  }, { onConflict: 'id' });
}

/** Human-readable product name: the template's title, resolved from its slug. */
async function productName(sb, slug) {
  if (!sb) return slug;
  const { data } = await sb.from('hb_templates').select('title').eq('slug', slug).maybeSingle();
  return data?.title ?? slug;
}

function sign(secret, slug, email, exp) {
  return crypto.createHmac('sha256', secret).update(`${slug}.${email}.${exp}`).digest('hex');
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
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
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
  // fetch does not throw on 4xx/5xx — without this the delivery email fails silently.
  if (!res.ok) logError('stripe-webhook:brevo', `${res.status} ${await res.text().catch(() => '')}`);
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
    logError('stripe-webhook:signature', err);
    return new Response('Webhook signature error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const slug = s.metadata?.slug;
    const tier = s.metadata?.tier === 'extended' ? 'extended' : 'single';
    const email = s.customer_details?.email || s.customer_email;
    const name = slug ? await productName(sb, slug) : null;
    // Record the sale in the admin DB (independent of email delivery).
    // Never fail the webhook on a bookkeeping error — but do surface it in the logs.
    try { await recordSale(sb, s, slug, name, email); } catch (err) { logError('stripe-webhook:recordSale', err); }

    let license = null;
    if (slug && email) {
      // Stripe retries a failed webhook delivery for up to ~3 days, so "now" can
      // land long after the actual purchase; use the session's own timestamp
      // (Unix seconds, hence * 1000) so a delayed retry never silently grants the
      // customer extra, unpaid-for update entitlement.
      const purchasedAt = s.created ? new Date(s.created * 1000).toISOString() : new Date().toISOString();
      try {
        license = await createLicenseForSale(sb, {
          saleId: s.id,
          slug,
          tier,
          email,
          purchasedAt,
        });
      } catch (err) { logError('stripe-webhook:createLicense', err); }
    }

    if (slug && email) {
      const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
      const sigv = sign(dlSecret, slug, email, exp);
      const origin = process.env.URL || 'https://hbstudio-co.netlify.app';
      // download.mjs still reads the query param named "item" -- kept as-is here,
      // only the value it carries is now the template slug (see report for why).
      const params = new URLSearchParams({ item: slug, email, exp: String(exp), sig: sigv });
      const link = `${origin}/api/download?${params.toString()}`;
      try { await sendDeliveryEmail(settings, email, name, link, ttlDays); } catch (err) { logError('stripe-webhook:sendDeliveryEmail', err); }
    }
  }

  return Response.json({ received: true });
};
