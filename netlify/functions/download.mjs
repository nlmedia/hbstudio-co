import crypto from 'node:crypto';
import { getSupabase, loadSettings, pick, logError } from './_lib.mjs';

export const config = { path: '/api/download' };

/**
 * Storage path to serve for a template. Serves the latest published version;
 * falls back to the legacy `deliverable` column when no version has been
 * published yet, so purchases in flight keep working.
 */
async function resolvePath(sb, slug) {
  const { data: template } = await sb
    .from('hb_templates')
    .select('id, deliverable')
    .eq('slug', slug)
    .maybeSingle();
  if (!template) return null;

  const { data: version } = await sb
    .from('hb_template_versions')
    .select('package')
    .eq('template_id', template.id)
    .order('released_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return version?.package || template.deliverable || null;
}

function safeEqual(a, b) {
  const ba = Buffer.from(a || '', 'hex');
  const bb = Buffer.from(b || '', 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Enforces license status for a download. `slug` is the template slug carried
 * by the `item` query param, `email` is the link's own email param.
 *
 * Rule, applied exactly:
 *  - at least one ACTIVE license for this (slug, email) pair -> allow
 *  - licenses exist but every one of them is REVOKED             -> deny (403)
 *  - no license row at all                                        -> allow
 *
 * The third case is deliberate, not an oversight: purchases made before this
 * licensing system existed have no hb_licenses row at all, and refusing them
 * here would cut off access for customers who already paid legitimately. Do
 * not "tighten" this to deny-by-default -- that would break those purchases.
 *
 * @returns {Promise<Response|null>} a 403 Response to short-circuit the
 *   download, or null when the download may proceed.
 */
async function enforceLicense(sb, slug, email) {
  const { data: template } = await sb.from('hb_templates').select('id').eq('slug', slug).maybeSingle();
  if (!template) return null; // unresolved slug: resolvePath() will 404 right after this call

  // hb_licenses is indexed on lower(email) (see migrations/20260731_licenses.sql);
  // ilike gives a case-insensitive match here since the email itself never
  // contains the % / _ wildcards ilike would otherwise interpret.
  const { data: licenses, error } = await sb
    .from('hb_licenses')
    .select('status')
    .eq('template_id', template.id)
    .ilike('email', email);

  if (error) {
    // A lookup failure is not the same thing as "no license found": fail open
    // rather than withhold a download from a customer who already paid,
    // matching how the rest of this system treats licensing as best-effort
    // bookkeeping around a purchase that already happened. Still logged loudly
    // because it is a genuine anomaly, unlike the revoked-license case below.
    logError('download:enforceLicense', `license lookup failed for slug "${slug}", email "${email}": ${error.message || error}`);
    return null;
  }
  if (!licenses || licenses.length === 0) return null; // no license row: pre-licensing purchase, allow
  if (licenses.some((l) => l.status === 'active')) return null;

  // Every license for this pair is revoked -- this is the system working as
  // designed (refund/dispute already revoked it), not a failure. Do not log it
  // as an error.
  return new Response('This license has been revoked. Please contact support if you believe this is an error.', { status: 403 });
}

export default async (req) => {
  const sb = getSupabase();
  const settings = await loadSettings(sb, ['download_secret']);
  const secret = pick(settings, 'download_secret', 'DOWNLOAD_SECRET');
  if (!secret) return new Response('Downloads not configured.', { status: 503 });

  const url = new URL(req.url);
  const item = url.searchParams.get('item');
  const email = url.searchParams.get('email');
  const exp = url.searchParams.get('exp');
  const sig = url.searchParams.get('sig');

  if (!item || !email || !exp || !sig) {
    return new Response('Invalid download link.', { status: 400 });
  }
  if (Date.now() > Number(exp)) {
    return new Response('This download link has expired. Please contact support for a new one.', { status: 410 });
  }
  const expected = crypto.createHmac('sha256', secret).update(`${item}.${email}.${exp}`).digest('hex');
  if (!safeEqual(sig, expected)) {
    return new Response('Invalid or tampered download link.', { status: 403 });
  }

  if (!sb) return new Response('Downloads not configured.', { status: 503 });

  const licenseDenied = await enforceLicense(sb, item, email);
  if (licenseDenied) return licenseDenied;

  const path = await resolvePath(sb, item);
  if (!path) {
    logError('download:resolvePath', `no deliverable found for slug "${item}"`);
    return new Response('File not available yet. Please contact support.', { status: 404 });
  }

  // Hand off to a short-lived Supabase signed URL (the file streams from storage, not this function).
  // 300s is not arbitrary: this window only has to cover the actual file transfer, because the real
  // access control already happened above (HMAC link, its own day-scale expiry, and the signature
  // check). This URL is never published anywhere -- it only exists for the length of one redirect --
  // so widening it doesn't weaken security. Themes run tens of MB and only grow, so on a slow mobile
  // connection 120s can cut a download off mid-transfer with no clear error for a paying customer.
  // Do not shrink this back down "for security": that protection lives upstream, not here.
  const { data, error } = await sb.storage.from('deliverables').createSignedUrl(path, 300, { download: true });
  if (error || !data?.signedUrl) {
    logError('download:createSignedUrl', error || `no signed URL for ${path}`);
    return new Response('Could not fetch the file. Please contact support.', { status: 500 });
  }
  return Response.redirect(data.signedUrl, 302);
};
