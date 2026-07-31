# Automatic file delivery (after Stripe payment)

Flow: customer pays → Stripe sends a `checkout.session.completed` webhook →
`/api/stripe-webhook` emails a **signed, 7-day download link** → `/api/download`
verifies the link, resolves the file **per template from the DB**, and redirects to a
short-lived **Supabase Storage signed URL** from the private `deliverables` bucket
(the files are never public nor in the repo).

## Prerequisites
Stripe Checkout already works (see `STRIPE-SETUP.md`, `STRIPE_SECRET_KEY` set).

## 1. Environment variables (Netlify → Site configuration → Environment variables)
| Key | Value |
|---|---|
| `STRIPE_SECRET_KEY` | your Stripe secret key (already set for checkout) |
| `STRIPE_WEBHOOK_SECRET` | from the webhook you create in step 2 (`whsec_…`) |
| `DOWNLOAD_SECRET` | any long random string (e.g. `openssl rand -hex 32`) |
| `PUBLIC_SUPABASE_URL` | Supabase project URL (resolves the deliverable + signs the URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (reads the private bucket) |
| `RESEND_API_KEY` | from https://resend.com (free tier) |
| `EMAIL_FROM` | e.g. `HB Studio Co <support@webcomsysteme.com>` (verify the domain in Resend; or use `onboarding@resend.dev` to test) |

`URL` is provided automatically by Netlify.

## 2. Create the Stripe webhook
- Stripe Dashboard → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://hbstudio-co.netlify.app/api/stripe-webhook`
- Events — all four, the endpoint only receives what it subscribes to:
  - **`checkout.session.completed`** — records the sale, issues the license, sends the email.
  - **`charge.refunded`** — revokes the license (a *partial* refund is ignored on purpose).
  - **`charge.dispute.created`** — revokes the license: the money is held by Stripe from
    the moment a chargeback is opened.
  - **`charge.dispute.closed`** — the counterpart of the previous one. If the dispute is
    **won**, the payment is final and the licenses that the chargeback revoked go back to
    `active`. Missing this one is not visible anywhere: nothing errors, the customer is
    simply left paying for an access they no longer have.
- Save, then copy the **Signing secret** (`whsec_…`) → set `STRIPE_WEBHOOK_SECRET` in Netlify.

## 3. Upload the deliverable files (private — not in the repo)
**Per template:** in **Admin → Templates → (edit) → Fichier livrable**, click
“Importer le ZIP”. The file is stored in the private Supabase `deliverables` bucket
and its path is saved on the template — that's all.

**License bundles** (`single`/`extended`/`all-access`) resolve to fixed paths in the
same bucket (see `BUNDLES` in `netlify/functions/download.mjs`, e.g. `bundles/atelier.zip`).
Upload those once via the Supabase dashboard (Storage → `deliverables`) at the matching paths.

## 4. Test end to end
- Use Stripe **test mode** keys + card `4242 4242 4242 4242`.
- Stripe Dashboard → Webhooks → your endpoint → **Send test webhook** (`checkout.session.completed`)
  to confirm the function runs (check Netlify → Functions logs).
- Do a real test checkout → you should receive the email with a working download link.

## Notes
- Links expire after 7 days (`DOWNLOAD_TTL_MS` in `stripe-webhook.mjs`). Adjust if needed.
- The download is gated by an HMAC signature tied to item + email + expiry — links can’t be forged or guessed.
- To sell a new template: just create/publish it in the admin and upload its
  “Fichier livrable” — pricing, checkout and delivery are all DB-driven. No code changes.
- Legacy: `tools/upload-deliverable.mjs` (Netlify Blobs) is no longer used.
