import Stripe from 'stripe';
import { getSupabase, loadSettings, pick, logError } from './_lib.mjs';
import { createLicenseForSale, revokeLicensesForSale, reinstateLicensesForSale } from '../../src/lib/licensing.mjs';
import { buildDownloadLink, sendDeliveryEmail } from '../../src/lib/delivery.mjs';

export const config = { path: '/api/stripe-webhook' };

/** Record a paid order into hb_sales (admin DB). Idempotent on the Stripe session id. */
async function recordSale(sb, session, slug, productName, email) {
  if (!sb) return;
  await sb.from('hb_sales').upsert({
    id: session.id,
    // hb_sales.item is the DB column name (read by src/pages/admin/index.astro
    // and src/pages/admin/sales.astro) -- it stays "item", only its source changes.
    item: productName || slug || 'unknown',
    amount: session.amount_total ?? null,
    currency: session.currency ?? 'eur',
    email: email ?? null,
    status: 'paid',
    raw: { slug, payment_intent: session.payment_intent, customer: session.customer },
  }, { onConflict: 'id' });
}

/** Human-readable product name: the template's title, resolved from its slug. */
async function productName(sb, slug) {
  if (!sb) return slug;
  const { data } = await sb.from('hb_templates').select('title').eq('slug', slug).maybeSingle();
  return data?.title ?? slug;
}

/**
 * Whether a Stripe Charge has been refunded IN FULL, not just partially.
 *
 * `charge.refunded` fires on any refund, partial included, so this decides
 * whether it should revoke the license. `amount` (the charge's original
 * amount) and `amount_refunded` (cumulative amount refunded so far, can be
 * less than `amount` for a partial refund) are both confirmed top-level
 * fields on the Charge object in node_modules/stripe/types/Charges.d.ts
 * (lines 25 and 35) -- both integers in the smallest currency unit, so a
 * direct comparison is exact, no float rounding involved. `>=` rather than
 * `===` only as a defensive guard against an over-refund Stripe should never
 * actually send.
 *
 * Kept pure and exported so the partial/total distinction can be verified
 * against hand-built Charge objects without a server or a database.
 *
 * @param {{amount: number, amount_refunded: number}} charge
 * @returns {boolean}
 */
export function isFullRefund(charge) {
  return (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
}

/**
 * Whether an event is a chargeback that CLOSED IN THE MERCHANT'S FAVOUR.
 *
 * `charge.dispute.closed` fires whatever the outcome, and only one of those
 * outcomes gives the customer their license back. Per Stripe's Dispute object
 * (node_modules/stripe/types/Disputes.d.ts, `status`), a closed dispute is
 * `won`, `lost`, or `warning_closed` -- the last one being an early warning
 * that never became a real dispute, so no money ever moved and there was never
 * anything to revoke. Only `won` means the funds stay with the merchant: the
 * customer paid, the payment is final, and keeping their theme revoked would
 * be charging them for nothing.
 *
 * `lost` deliberately does nothing: the money is gone, the revocation stands.
 *
 * Kept pure and exported, like isFullRefund above, so the won/lost/warning
 * distinction can be verified against hand-built events without a server or a
 * database.
 *
 * @param {{type?: string, data?: {object?: {status?: string}}}} event
 * @returns {boolean}
 */
export function isDisputeWon(event) {
  return event?.type === 'charge.dispute.closed' && event?.data?.object?.status === 'won';
}

export default async (req) => {
  const sb = getSupabase();
  const settings = await loadSettings(sb, [
    'stripe_secret_key', 'stripe_webhook_secret', 'download_secret', 'download_ttl_days',
    'brevo_api_key', 'sender_email', 'sender_name', 'reply_to',
  ]);
  const key = pick(settings, 'stripe_secret_key', 'STRIPE_SECRET_KEY');
  const whsec = pick(settings, 'stripe_webhook_secret', 'STRIPE_WEBHOOK_SECRET');
  const dlSecret = pick(settings, 'download_secret', 'DOWNLOAD_SECRET');
  const ttlDays = Number(settings.download_ttl_days || 7);
  if (!key || !whsec || !dlSecret) {
    return new Response('not_configured', { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, sig, whsec);
  } catch (err) {
    logError('stripe-webhook:signature', err);
    return new Response('Webhook signature error', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const slug = s.metadata?.slug;
    const tier = s.metadata?.tier === 'extended' ? 'extended' : 'single';
    const email = s.customer_details?.email || s.customer_email;
    const name = slug ? await productName(sb, slug) : null;
    // Record the sale in the admin DB (independent of email delivery).
    // Never fail the webhook on a bookkeeping error — but do surface it in the logs.
    try { await recordSale(sb, s, slug, name, email); } catch (err) { logError('stripe-webhook:recordSale', err); }

    let license = null;
    if (slug && email) {
      // Stripe retries a failed webhook delivery for up to ~3 days, so "now" can
      // land long after the actual purchase; use the session's own timestamp
      // (Unix seconds, hence * 1000) so a delayed retry never silently grants the
      // customer extra, unpaid-for update entitlement.
      const purchasedAt = s.created ? new Date(s.created * 1000).toISOString() : new Date().toISOString();
      try {
        license = await createLicenseForSale(sb, {
          saleId: s.id,
          slug,
          tier,
          email,
          purchasedAt,
        });
      } catch (err) { logError('stripe-webhook:createLicense', err); }

      // createLicenseForSale can come back null even though a license exists: if
      // Stripe replays this event and two invocations overlap, both pass its
      // existence check before either has inserted, then the loser of the race
      // hits the hb_licenses_sale_uidx unique index and returns null. Re-read once
      // by sale_id before giving up, so we pick up the winner's row instead of
      // sending this customer an email without their key.
      if (!license && sb) {
        const { data: raced, error: raceErr } = await sb
          .from('hb_licenses')
          .select('*')
          .eq('sale_id', s.id)
          .maybeSingle();
        if (raceErr) {
          logError('stripe-webhook:createLicense', `re-read after null failed for sale ${s.id}: ${raceErr.message || raceErr}`);
        } else if (raced) {
          license = raced;
        } else {
          // Genuinely no license anywhere -- the customer paid and will get an
          // email without a key. Must not vanish silently.
          logError('stripe-webhook:createLicense', `sale ${s.id} paid but no license found after re-read (slug "${slug}")`);
        }
      } else if (!license && !sb) {
        // No DB connection at all, so the race re-read can't even run -- the
        // customer paid and will get an email without a key, with no way for us to
        // tell whether one exists. Must not vanish silently.
        logError('stripe-webhook:createLicense', `sale ${s.id} paid but no license and no DB connection to re-check (slug "${slug}")`);
      }
    }

    if (slug && email) {
      const origin = process.env.URL || 'https://hbstudio-co.netlify.app';
      // download.mjs still reads the query param named "item" -- kept as-is here,
      // only the value it carries is now the template slug (see report for why).
      const link = buildDownloadLink({ secret: dlSecret, slug, email, ttlDays, origin });
      try {
        await sendDeliveryEmail(settings, email, name, link, ttlDays, license, origin, logError, 'stripe-webhook:brevo');
      } catch (err) { logError('stripe-webhook:sendDeliveryEmail', err); }
    }
  }

  // A dispute that closed as `lost` or `warning_closed` is filtered out right
  // here rather than further down: there is nothing to do for either, and going
  // through the sale lookup would log a spurious "no sale found" for a dispute
  // nobody ever expected to act on.
  const disputeWon = isDisputeWon(event);

  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created' || disputeWon) {
    // Both the Charge object (charge.refunded) and the Dispute object
    // (charge.dispute.created / .closed) carry the id of the PaymentIntent they
    // belong to in a top-level `payment_intent` field -- confirmed against Stripe's own
    // type definitions (node_modules/stripe/types/Charges.d.ts and Disputes.d.ts),
    // both typed `string | Stripe.PaymentIntent | null`. It is never expanded
    // here, so in practice it is always the plain id string; the object branch
    // below is only a defensive fallback.
    const obj = event.data.object;
    const paymentIntentId = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id;
    // Same failure modes on both paths, but a log line saying "revoke" while
    // reinstating would send whoever reads it looking for the wrong bug.
    const logTag = disputeWon ? 'stripe-webhook:reinstate' : 'stripe-webhook:revoke';

    if (!paymentIntentId) {
      logError(logTag, `${event.type}: event ${event.id} has no payment_intent -- cannot locate the sale it applies to`);
    } else if (!sb) {
      logError(logTag, `${event.type}: no DB connection -- cannot look up sale for payment_intent ${paymentIntentId}`);
    } else {
      // hb_sales has no dedicated payment_intent column; it is only recorded inside
      // the raw jsonb blob (see recordSale above), hence the ->> lookup.
      const { data: sales, error: salesErr } = await sb
        .from('hb_sales')
        .select('id')
        .eq('raw->>payment_intent', paymentIntentId);

      if (salesErr) {
        logError(logTag, `${event.type}: sale lookup failed for payment_intent ${paymentIntentId}: ${salesErr.message || salesErr}`);
      } else if (!sales || sales.length === 0) {
        // Refunded/disputed money with no sale to tie it to -- a human needs to reconcile this by hand.
        logError(logTag, `${event.type}: no sale found for payment_intent ${paymentIntentId} -- refund/dispute could not be applied to any license`);
      } else if (event.type === 'charge.refunded' && !isFullRefund(obj)) {
        // Only a full refund revokes the license -- a partial goodwill refund must
        // not cost the customer their whole theme. Not an error, but still a
        // commercial event worth a trace: logged with both amounts and every sale
        // it would have applied to, same as the other logError calls in this block.
        for (const sale of sales) {
          logError(
            'stripe-webhook:revoke',
            `charge.refunded: partial refund for sale ${sale.id} (payment_intent ${paymentIntentId}) -- amount_refunded=${obj.amount_refunded} of amount=${obj.amount} -- license NOT revoked`
          );
        }
      } else {
        for (const sale of sales) {
          try {
            if (disputeWon) {
              // revokedFor must be the exact string the revocation stored, and
              // that string is the event type charge.dispute.created ran under
              // (see the revokeLicensesForSale call just below, whose `reason`
              // argument is event.type). Anything revoked for another reason --
              // a refund, an admin decision -- deliberately stays revoked.
              await reinstateLicensesForSale(sb, sale.id, {
                revokedFor: 'charge.dispute.created',
                reason: event.type,
              });
            } else {
              await revokeLicensesForSale(sb, sale.id, event.type);
            }
          } catch (err) {
            const fn = disputeWon ? 'reinstateLicensesForSale' : 'revokeLicensesForSale';
            logError(logTag, `${event.type}: ${fn} threw for sale ${sale.id}: ${err.message || err}`);
          }
        }
      }
    }
  }

  return Response.json({ received: true });
};
