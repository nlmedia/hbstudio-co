# Activating Stripe Checkout

The store is fully wired for Stripe Checkout via a Netlify Function
(`netlify/functions/create-checkout.mjs`, served at `/api/checkout`).
Until you add your secret key, "Buy" buttons show a friendly "checkout opens
soon" message. To go live:

## 1. Create a Stripe account
- Sign up at https://stripe.com and complete activation (business details + payout bank).
- Template prices are read **live from the database** (incl. active promos) — no need
  to edit code per template. Only the fixed license bundles live in `create-checkout.mjs`
  (`CATALOG`: `single`/`extended`/`all-access`, values in **cents**, EUR).

## 2. Add your secret key to Netlify (never in the code)
- Stripe Dashboard → **Developers → API keys** → copy the **Secret key** (`sk_live_…`,
  or `sk_test_…` to test first).
- Netlify → project **hbstudio-co** → **Site configuration → Environment variables → Add**:
  - `STRIPE_SECRET_KEY` — your Stripe secret key
  - `STRIPE_WEBHOOK_SECRET` — the webhook signing secret (see step 4)
  - `PUBLIC_SUPABASE_URL` — for live template pricing + recording sales
  - `PUBLIC_SUPABASE_ANON_KEY` — used by checkout to read published prices
  - `SUPABASE_SERVICE_ROLE_KEY` — used by the webhook to write into `hb_sales`
- Redeploy (or it applies on next deploy). That’s it — buttons now open Stripe Checkout.

## Sales sync (webhook → admin)
On `checkout.session.completed`, the webhook records the order into `hb_sales`
(idempotent on the Stripe session id), so it appears instantly in **Admin → Ventes**
and the dashboard. Requires `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` above.

## 3. Test
- Use a test key and Stripe’s test card `4242 4242 4242 4242`, any future date / CVC.
- Buy flow: button → Stripe Checkout → on success redirects to `/success`, on cancel `/cancel`.

## 4. Deliver the files (choose one)
The success page tells buyers their download link is emailed. To fulfil:
- **Simple:** watch Stripe payments and email the ZIP manually (low volume).
- **Automated (recommended later):** add a Stripe **webhook** → a second Netlify function
  that emails a signed download link on `checkout.session.completed`. Ask and I’ll build it.

## Catalogue keys (data-checkout values)
- **Template slugs** (e.g. `atelier`, `studio`, …): priced live from the DB, promo-aware.
  Manage price/promo in **Admin → Templates**.
- **License bundles**: `single` (€69) · `extended` (€149) · `all-access` (€299) —
  edit names/prices in `netlify/functions/create-checkout.mjs`.
