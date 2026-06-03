# Activating Stripe Checkout

The store is fully wired for Stripe Checkout via a Netlify Function
(`netlify/functions/create-checkout.mjs`, served at `/api/checkout`).
Until you add your secret key, "Buy" buttons show a friendly "checkout opens
soon" message. To go live:

## 1. Create a Stripe account
- Sign up at https://stripe.com and complete activation (business details + payout bank).
- No products to create — prices live server-side in `create-checkout.mjs` (`CATALOG`).
  Edit amounts there if needed (values are in **cents**, EUR).

## 2. Add your secret key to Netlify (never in the code)
- Stripe Dashboard → **Developers → API keys** → copy the **Secret key** (`sk_live_…`,
  or `sk_test_…` to test first).
- Netlify → project **hbstudio-co** → **Site configuration → Environment variables → Add**:
  - Key: `STRIPE_SECRET_KEY`
  - Value: your secret key
- Redeploy (or it applies on next deploy). That’s it — buttons now open Stripe Checkout.

## 3. Test
- Use a test key and Stripe’s test card `4242 4242 4242 4242`, any future date / CVC.
- Buy flow: button → Stripe Checkout → on success redirects to `/success`, on cancel `/cancel`.

## 4. Deliver the files (choose one)
The success page tells buyers their download link is emailed. To fulfil:
- **Simple:** watch Stripe payments and email the ZIP manually (low volume).
- **Automated (recommended later):** add a Stripe **webhook** → a second Netlify function
  that emails a signed download link on `checkout.session.completed`. Ask and I’ll build it.

## Catalogue keys (data-checkout values)
`atelier` (€169) · `single` (€69) · `extended` (€149) · `all-access` (€299)
Edit names/prices in `netlify/functions/create-checkout.mjs`.
