import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// Fixed license bundles → storage path in the private "deliverables" bucket.
const BUNDLES = {
  single: 'bundles/atelier.zip',
  extended: 'bundles/atelier.zip',
  'all-access': 'bundles/all-access.zip',
};

export const config = { path: '/api/download' };

function sbClient() {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Resolve the storage path for a purchased item (bundle key or template slug). */
async function resolvePath(sb, item) {
  if (BUNDLES[item]) return BUNDLES[item];
  const { data } = await sb.from('hb_templates').select('deliverable').eq('slug', item).maybeSingle();
  return data?.deliverable || null;
}

function safeEqual(a, b) {
  const ba = Buffer.from(a || '', 'hex');
  const bb = Buffer.from(b || '', 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export default async (req) => {
  const secret = process.env.DOWNLOAD_SECRET;
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

  const sb = sbClient();
  if (!sb) return new Response('Downloads not configured.', { status: 503 });

  const path = await resolvePath(sb, item);
  if (!path) return new Response('File not available yet. Please contact support.', { status: 404 });

  // Hand off to a short-lived Supabase signed URL (the file streams from storage, not this function).
  const { data, error } = await sb.storage.from('deliverables').createSignedUrl(path, 120, { download: true });
  if (error || !data?.signedUrl) {
    return new Response('Could not fetch the file. Please contact support.', { status: 500 });
  }
  return Response.redirect(data.signedUrl, 302);
};
