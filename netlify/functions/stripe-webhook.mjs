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

/**
 * Formats an ISO date string for a French reader. A malformed or missing value
 * must never surface as "Invalid Date", "undefined" or "null" in a customer email.
 */
function formatFrenchDate(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'date indisponible';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** "1 site" / "N sites" — guards against a missing or non-numeric seat count. */
function seatsLabel(seats) {
  const n = Number(seats);
  if (!Number.isFinite(n) || n <= 0) return 'plusieurs sites';
  return n === 1 ? '1 site' : `${n} sites`;
}

/**
 * Escapes HTML special characters before interpolation into the delivery email.
 * `&` must run first — escaping it after the others would double-escape the
 * entities those replacements just produced. Tolerates null/undefined (never
 * emits the word "undefined").
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pure HTML renderer for the delivery email. Kept free of any network/DB access
 * so it can be exercised directly (tests, manual proof) without hitting Brevo.
 * `license` may be null (e.g. a bookkeeping failure must never withhold the
 * download the customer already paid for) — the key insert simply disappears.
 */
export function renderDeliveryEmailHtml({ name, link, ttlDays, license, origin }) {
  // name (free-text hb_templates.title from the admin), the license key, and origin
  // are all attacker-or-editor-controlled to varying degrees -- escape every one of
  // them before interpolation so a title like "Black & White <Pro>" can never break
  // the email's markup or, worse, inject a tag.
  const safeName = escapeHtml(name);
  const safeOrigin = escapeHtml(origin);
  const licenseBlock = license
    ? `
      <div style="margin:24px 0;padding:16px 20px;border:1px solid #e4e4e9;border-radius:12px;background:#f7f7f9">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b6b73">Votre clé de licence</p>
        <p style="margin:0 0 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:17px;font-weight:600;letter-spacing:.03em;word-break:break-all;color:#0e0e12">${escapeHtml(license.key) || '—'}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#3a3a42">Licence valable pour <strong>${seatsLabel(license.seats)}</strong>.</p>
        <p style="margin:0 0 12px;font-size:13px;color:#3a3a42">Mises à jour incluses jusqu'au <strong>${formatFrenchDate(license.updates_until)}</strong>.</p>
        <p style="margin:0;font-size:13px"><a href="${safeOrigin}/account" style="color:#0e0e12;font-weight:600">Retrouvez votre licence dans votre espace client →</a></p>
      </div>`
    : '';
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0e0e12">
      <h1 style="font-family:Georgia,serif">Merci pour votre achat 🎉</h1>
      <p>Votre <strong>${safeName}</strong> est prêt à être téléchargé.</p>
      ${licenseBlock}
      <p><a href="${link}" style="display:inline-block;background:#0e0e12;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Télécharger vos fichiers</a></p>
      <p style="font-size:13px;color:#6b6b73">Ce lien est valable ${ttlDays} jours. La documentation est incluse dans le téléchargement.<br>Une question ? Répondez simplement à cet e-mail.</p>
      <p style="font-size:12px;color:#9a9aa6">— HB Studio Co</p>
    </div>`;
}

/** Send the download email via Brevo (single email provider for the whole app). */
async function sendDeliveryEmail(settings, to, name, link, ttlDays, license, origin) {
  const apiKey = settings.brevo_api_key;
  const senderEmail = settings.sender_email;
  if (!apiKey || !senderEmail) return; // email not configured
  const html = renderDeliveryEmailHtml({ name, link, ttlDays, license, origin });
  const subject = license ? `Votre clé de licence — ${name}` : `Votre ${name} est prêt à télécharger`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: settings.sender_name || 'HB Studio Co', email: senderEmail },
      ...(settings.reply_to ? { replyTo: { email: settings.reply_to } } : {}),
      to: [{ email: to }],
      subject,
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

      // createLicenseForSale can come back null even though a license exists: if
      // Stripe replays this event and two invocations overlap, both pass its
      // existence check before either has inserted, then the loser of the race
      // hits the hb_licenses_sale_uidx unique index and returns null. Re-read once
      // by sale_id before giving up, so we pick up the winner's row instead of
      // sending this customer an email without their key.
      if (!license && sb) {
        const { data: raced, error: raceErr } = await sb
          .from('hb_licenses')
          .select('*')
          .eq('sale_id', s.id)
          .maybeSingle();
        if (raceErr) {
          logError('stripe-webhook:createLicense', `re-read after null failed for sale ${s.id}: ${raceErr.message || raceErr}`);
        } else if (raced) {
          license = raced;
        } else {
          // Genuinely no license anywhere -- the customer paid and will get an
          // email without a key. Must not vanish silently.
          logError('stripe-webhook:createLicense', `sale ${s.id} paid but no license found after re-read (slug "${slug}")`);
        }
      } else if (!license && !sb) {
        // No DB connection at all, so the race re-read can't even run -- the
        // customer paid and will get an email without a key, with no way for us to
        // tell whether one exists. Must not vanish silently.
        logError('stripe-webhook:createLicense', `sale ${s.id} paid but no license and no DB connection to re-check (slug "${slug}")`);
      }
    }

    if (slug && email) {
      const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
      const sigv = sign(dlSecret, slug, email, exp);
      const origin = process.env.URL || 'https://hbstudio-co.netlify.app';
      // download.mjs still reads the query param named "item" -- kept as-is here,
      // only the value it carries is now the template slug (see report for why).
      const params = new URLSearchParams({ item: slug, email, exp: String(exp), sig: sigv });
      const link = `${origin}/api/download?${params.toString()}`;
      try { await sendDeliveryEmail(settings, email, name, link, ttlDays, license, origin); } catch (err) { logError('stripe-webhook:sendDeliveryEmail', err); }
    }
  }

  return Response.json({ received: true });
};
