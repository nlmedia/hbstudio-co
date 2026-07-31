import crypto from 'node:crypto';

/**
 * Signs a download link. `download.mjs` recomputes this exact HMAC to validate
 * the link -- the string being hashed must stay byte-for-byte identical to
 * what it expects, forever, or every link already emailed to a customer
 * (including ones sitting unopened in an inbox right now) stops working.
 *
 * `slug` is passed positionally and named `slug` here, but the query
 * parameter it ends up in is called `item` (see buildDownloadLink below) --
 * that mismatch is intentional and pre-existing, not something to "fix".
 *
 * @param {string} secret
 * @param {string} slug template slug
 * @param {string} email
 * @param {number} exp expiry, ms since epoch
 * @returns {string} hex-encoded HMAC-SHA256
 */
export function sign(secret, slug, email, exp) {
  return crypto.createHmac('sha256', secret).update(`${slug}.${email}.${exp}`).digest('hex');
}

/**
 * Builds a signed download link for a template.
 *
 * The URL parameter is named `item` even though the value it carries is a
 * template SLUG -- that is how `download.mjs` reads it on the other end, and
 * renaming it here would break every link already handed out. Kept as-is on
 * purpose.
 *
 * @param {object} params
 * @param {string} params.secret download_secret from hb_settings/env
 * @param {string} params.slug template slug
 * @param {string} params.email recipient
 * @param {number} params.ttlDays link validity window, in days
 * @param {string} params.origin site origin, e.g. https://hbstudio-co.netlify.app
 * @returns {string} the full download URL
 */
export function buildDownloadLink({ secret, slug, email, ttlDays, origin }) {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const sigv = sign(secret, slug, email, exp);
  const params = new URLSearchParams({ item: slug, email, exp: String(exp), sig: sigv });
  return `${origin}/api/download?${params.toString()}`;
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

/**
 * Send the download email via Brevo (single email provider for the whole app).
 * `logError` is injected rather than imported, so this file (and the rest of
 * this module) stays free of any dependency on netlify/functions/_lib.mjs.
 * `scope` is injected too, defaulting to this module's own tag -- passed
 * explicitly by stripe-webhook.mjs as 'stripe-webhook:brevo' so its log output
 * is byte-for-byte the same as before this file existed.
 *
 * @returns {Promise<{ok: boolean, reason: 'sent'|'not_configured'|'send_failed'}>}
 *   The Stripe webhook caller ignores this (fire-and-forget, same as always);
 *   the manual-license admin page uses it to tell the admin, on screen,
 *   whether the customer actually received anything.
 */
export async function sendDeliveryEmail(settings, to, name, link, ttlDays, license, origin, logError, scope = 'delivery:brevo') {
  const apiKey = settings.brevo_api_key;
  const senderEmail = settings.sender_email;
  if (!apiKey || !senderEmail) return { ok: false, reason: 'not_configured' }; // email not configured
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
  if (!res.ok) {
    logError(scope, `${res.status} ${await res.text().catch(() => '')}`);
    return { ok: false, reason: 'send_failed' };
  }
  return { ok: true, reason: 'sent' };
}
