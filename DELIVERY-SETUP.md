# Automatic file delivery (after Stripe payment)

Flow: customer pays → Stripe sends a `checkout.session.completed` webhook →
`/api/stripe-webhook` emails a **signed, 7-day download link** → `/api/download`
verifies the link and serves the file from a **private Netlify Blobs store**
(the files are never in the public repo).

## Prerequisites
Stripe Checkout already works (see `STRIPE-SETUP.md`, `STRIPE_SECRET_KEY` set).

## 1. Environment variables (Netlify → Site configuration → Environment variables)
| Key | Value |
|---|---|
| `STRIPE_SECRET_KEY` | your Stripe secret key (already set for checkout) |
| `STRIPE_WEBHOOK_SECRET` | from the webhook you create in step 2 (`whsec_…`) |
| `DOWNLOAD_SECRET` | any long random string (e.g. `openssl rand -hex 32`) |
| `RESEND_API_KEY` | from https://resend.com (free tier) |
| `EMAIL_FROM` | e.g. `HB Studio Co <support@webcomsysteme.com>` (verify the domain in Resend; or use `onboarding@resend.dev` to test) |

`URL` is provided automatically by Netlify.

## 2. Create the Stripe webhook
- Stripe Dashboard → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://hbstudio-co.netlify.app/api/stripe-webhook`
- Event: **`checkout.session.completed`**
- Save, then copy the **Signing secret** (`whsec_…`) → set `STRIPE_WEBHOOK_SECRET` in Netlify.

## 3. Upload the deliverable files (private — not in the repo)
Build the buyer package(s) and upload to the private Blobs store. Keys must be
`atelier` and/or `all-access` (see `FILES` in `netlify/functions/download.mjs`).

```bash
# Personal access token: https://app.netlify.com/user/applications
NETLIFY_SITE_ID=cb16d4a2-8ceb-4bbd-a5fa-ee0d7bbaa6e0 \
NETLIFY_AUTH_TOKEN=<your-token> \
node tools/upload-deliverable.mjs atelier "../Shopify/themes/atelier-v1.0.0.zip"
```

(Repeat with `all-access` and a bundle zip when ready.)

## 4. Test end to end
- Use Stripe **test mode** keys + card `4242 4242 4242 4242`.
- Stripe Dashboard → Webhooks → your endpoint → **Send test webhook** (`checkout.session.completed`)
  to confirm the function runs (check Netlify → Functions logs).
- Do a real test checkout → you should receive the email with a working download link.

## Notes
- Links expire after 7 days (`DOWNLOAD_TTL_MS` in `stripe-webhook.mjs`). Adjust if needed.
- The download is gated by an HMAC signature tied to item + email + expiry — links can’t be forged or guessed.
- To add a new product: add it to `PRODUCTS` (webhook), `FILES` (download), `CATALOG`
  (create-checkout), and upload its file with a matching key.
