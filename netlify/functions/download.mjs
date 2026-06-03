import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const FILES = {
  atelier: 'atelier',
  single: 'atelier',
  extended: 'atelier',
  'all-access': 'all-access',
};

export const config = { path: '/api/download' };

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
  const file = FILES[item];

  if (!item || !email || !exp || !sig || !file) {
    return new Response('Invalid download link.', { status: 400 });
  }
  if (Date.now() > Number(exp)) {
    return new Response('This download link has expired. Please contact support for a new one.', { status: 410 });
  }
  const expected = crypto.createHmac('sha256', secret).update(`${item}.${file}.${email}.${exp}`).digest('hex');
  if (!safeEqual(sig, expected)) {
    return new Response('Invalid or tampered download link.', { status: 403 });
  }

  try {
    const store = getStore('deliverables');
    const data = await store.get(file, { type: 'arrayBuffer' });
    if (!data) return new Response('File not available yet. Please contact support.', { status: 404 });
    return new Response(data, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${file}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response('Could not fetch the file. Please contact support.', { status: 500 });
  }
};
