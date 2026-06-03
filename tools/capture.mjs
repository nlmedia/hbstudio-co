/**
 * Capture a full-page screenshot for a template mockup.
 *
 * Usage:
 *   1) Run the template's dev/live store (e.g. `shopify theme dev` on :9294)
 *   2) npx playwright install chromium   # first time only
 *   3) node tools/capture.mjs <url> <slug>
 *      e.g. node tools/capture.mjs http://localhost:9294/ atelier
 *
 * Outputs public/templates/<slug>/home-full.jpg (900px wide).
 * Requires: npx playwright + (macOS) sips for the JPG step, or swap in sharp.
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:9294/';
const slug = process.argv[3] || 'atelier';
const dir = new URL(`../public/templates/${slug}`, import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const png = `${dir}/home-full.png`;
const jpg = `${dir}/home-full.jpg`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.4 });
await ctx.addInitScript(() => { try { localStorage.setItem('atelier:nlpop', String(Date.now())); } catch {} });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
for (const re of [/decline/i, /refuser/i, /accept/i]) {
  try { const b = page.getByRole('button', { name: re }); if (await b.count()) { await b.first().click({ timeout: 1000 }); break; } } catch {}
}
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
await page.waitForTimeout(1500);
await page.screenshot({ path: png, fullPage: true });
await browser.close();

// optimize to 900px-wide JPG (macOS sips)
execSync(`sips -s format jpeg -s formatOptions 80 --resampleWidth 900 "${png}" --out "${jpg}"`);
execSync(`rm -f "${png}"`);
console.log('Saved', jpg);
