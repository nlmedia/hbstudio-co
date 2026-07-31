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

  const path = await resolvePath(sb, item);
  if (!path) {
    logError('download:resolvePath', `no deliverable found for slug "${item}"`);
    return new Response('File not available yet. Please contact support.', { status: 404 });
  }

  // Hand off to a short-lived Supabase signed URL (the file streams from storage, not this function).
  const { data, error } = await sb.storage.from('deliverables').createSignedUrl(path, 120, { download: true });
  if (error || !data?.signedUrl) {
    logError('download:createSignedUrl', error || `no signed URL for ${path}`);
    return new Response('Could not fetch the file. Please contact support.', { status: 500 });
  }
  return Response.redirect(data.signedUrl, 302);
};
