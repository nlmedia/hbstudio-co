/**
 * Upload a deliverable file to the private "deliverables" Netlify Blobs store.
 * The download function (/api/download) serves these to paying customers only.
 *
 * Usage:
 *   NETLIFY_SITE_ID=<site-id> NETLIFY_AUTH_TOKEN=<token> \
 *     node tools/upload-deliverable.mjs <key> <path-to-file>
 *
 *   e.g. node tools/upload-deliverable.mjs atelier "../Shopify/themes/atelier-v1.0.0.zip"
 *
 * - <key> must match a value in FILES (download.mjs): "atelier" or "all-access".
 * - Get a token at https://app.netlify.com/user/applications (Personal access token).
 * - Site ID is cb16d4a2-8ceb-4bbd-a5fa-ee0d7bbaa6e0 (project hbstudio-co).
 */
import { getStore } from '@netlify/blobs';
import { readFileSync } from 'node:fs';

const [, , key, path] = process.argv;
if (!key || !path) { console.error('Usage: node tools/upload-deliverable.mjs <key> <file>'); process.exit(1); }

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) { console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN env vars.'); process.exit(1); }

const store = getStore({ name: 'deliverables', siteID, token });
await store.set(key, readFileSync(path));
console.log(`Uploaded "${key}" (${path}) to the deliverables store.`);
