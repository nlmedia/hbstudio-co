import { generateLicenseKey, seatsForTier, updatesUntilFrom } from './license.mjs';
import { logError } from '../../netlify/functions/_lib.mjs';

/**
 * Creates the license for a sale. Idempotent: if a license already exists for
 * this sale_id (a replayed Stripe webhook), that existing row is returned as-is.
 *
 * @returns {Promise<object|null>} the license, or null when creation is not possible
 */
export async function createLicenseForSale(sb, { saleId, slug, tier, email, purchasedAt }) {
  if (!sb || !slug || !email) return null;

  const { data: existing } = await sb
    .from('hb_licenses')
    .select('*')
    .eq('sale_id', saleId)
    .maybeSingle();
  if (existing) return existing;

  const { data: template } = await sb
    .from('hb_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!template) {
    // Paid but unlicensable: the slug the customer bought no longer resolves to a
    // template (renamed/removed). Needs a human to reissue against the right slug.
    logError(
      'licensing:createLicenseForSale',
      `template not found for slug "${slug}" -- sale ${saleId} (tier ${tier}) was paid but no license was issued`
    );
    return null;
  }

  const { data, error } = await sb
    .from('hb_licenses')
    .insert({
      key: generateLicenseKey(),
      template_id: template.id,
      tier,
      seats: seatsForTier(tier),
      email,
      sale_id: saleId,
      updates_until: updatesUntilFrom(purchasedAt),
    })
    .select()
    .single();

  if (error) {
    // The template exists but the insert itself was rejected (constraint, outage,
    // or the losing side of a concurrent webhook replay racing the uniqueness
    // guard on sale_id) -- needs a human to check the DB, not to re-map a slug.
    logError(
      'licensing:createLicenseForSale',
      `insert refused for sale ${saleId}, slug "${slug}" (tier ${tier}): ${error.message || error}`
    );
    return null;
  }
  return data;
}

/**
 * Revokes every license attached to a sale (refund, chargeback).
 * @returns {Promise<number>} number of licenses revoked
 */
export async function revokeLicensesForSale(sb, saleId, reason) {
  if (!sb || !saleId) return 0;

  const { data, error } = await sb
    .from('hb_licenses')
    .update({ status: 'revoked' })
    .eq('sale_id', saleId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    logError(
      'licensing:revokeLicensesForSale',
      `update refused for sale ${saleId} (reason: ${reason}): ${error.message || error}`
    );
    return 0;
  }

  for (const row of data ?? []) {
    const { error: eventError } = await sb.from('hb_license_events').insert({
      license_id: row.id,
      event: 'revoke',
      detail: { reason, sale_id: saleId },
    });
    if (eventError) {
      // The license is already revoked at this point -- only the audit trail is
      // missing, so this must not change the count returned to the caller.
      logError(
        'licensing:revokeLicensesForSale',
        `hb_license_events insert refused for license ${row.id}, sale ${saleId}: ${eventError.message || eventError}`
      );
    }
  }
  return (data ?? []).length;
}

/**
 * Puts back to `active` the licenses of a sale that were revoked FOR ONE
 * SPECIFIC REASON. The counterpart of revokeLicensesForSale -- used when a
 * chargeback is resolved in the merchant's favour and the money stays.
 *
 * The reason filter is the whole point of this function. A sale's license can
 * be revoked by three different things: a chargeback, a full refund, or an
 * admin's own decision in /admin/licenses/[id]. Winning a dispute only undoes
 * the first. Flipping every revoked license of the sale back to active would
 * hand a refunded customer their theme back for free, or silently overturn an
 * admin's manual decision.
 *
 * hb_licenses stores a status but never why, so the reason only survives in
 * hb_license_events.detail. Eligibility is read from the MOST RECENT `revoke`
 * event of each license -- the most recent one, because a license can have been
 * revoked, reinstated and revoked again for a different reason, and only the
 * last revocation explains why it is revoked *right now*. The admin UI's manual
 * revoke writes `{ actor }` with no `reason` at all, which lands on the refusing
 * side of the comparison on its own -- no special case needed for it.
 *
 * A license revoked with no `revoke` event at all (the event insert failed --
 * see revokeLicensesForSale, where that is logged but not fatal) stays revoked:
 * with the reason lost, refusing is the only side that cannot give away a
 * refunded theme. Every license left behind is logged, since from the
 * customer's point of view a won dispute that reinstates nothing is exactly the
 * support ticket this whole function exists to prevent.
 *
 * @param {object} sb Supabase client
 * @param {string} saleId
 * @param {{revokedFor: string, reason: string}} opts
 *   `revokedFor`: only licenses whose latest revocation carries this exact
 *   `detail.reason` are reinstated. `reason`: what gets traced on the new event.
 * @returns {Promise<number>} number of licenses reinstated
 */
export async function reinstateLicensesForSale(sb, saleId, { revokedFor, reason } = {}) {
  if (!sb || !saleId || !revokedFor) return 0;

  const { data: revoked, error: readError } = await sb
    .from('hb_licenses')
    .select('id')
    .eq('sale_id', saleId)
    .eq('status', 'revoked');

  if (readError) {
    logError(
      'licensing:reinstateLicensesForSale',
      `license lookup refused for sale ${saleId} (reason: ${reason}): ${readError.message || readError}`
    );
    return 0;
  }

  const ids = (revoked ?? []).map((row) => row.id);
  // Nothing revoked: the common case for a dispute the customer opened and lost
  // interest in, or a replay of an event already applied. Not worth a log line.
  if (ids.length === 0) return 0;

  const { data: events, error: eventsError } = await sb
    .from('hb_license_events')
    .select('license_id, detail')
    .in('license_id', ids)
    .eq('event', 'revoke')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (eventsError) {
    // Without the revocation history there is no way to tell a chargeback
    // revocation from a refund one, and reinstating blind is the single outcome
    // that can give away a refunded theme. So nothing is touched.
    logError(
      'licensing:reinstateLicensesForSale',
      `hb_license_events lookup refused for sale ${saleId} (reason: ${reason}): ${eventsError.message || eventsError}`
    );
    return 0;
  }

  // Newest first (created_at, then the identity id to break a tie between two
  // events written inside the same clock tick), so the first row seen for a
  // license is the revocation currently in force.
  const latestReason = new Map();
  for (const ev of events ?? []) {
    if (!latestReason.has(ev.license_id)) latestReason.set(ev.license_id, ev.detail?.reason ?? null);
  }

  const eligible = ids.filter((id) => latestReason.get(id) === revokedFor);
  for (const id of ids) {
    if (eligible.includes(id)) continue;
    logError(
      'licensing:reinstateLicensesForSale',
      `license ${id} of sale ${saleId} left revoked: its last revocation reason was ${JSON.stringify(latestReason.get(id) ?? null)}, not "${revokedFor}"`
    );
  }
  if (eligible.length === 0) return 0;

  // .eq('status', 'revoked') is what makes a replayed webhook harmless: the
  // second delivery matches no row and writes no second reinstate event.
  const { data, error } = await sb
    .from('hb_licenses')
    .update({ status: 'active' })
    .eq('sale_id', saleId)
    .eq('status', 'revoked')
    .in('id', eligible)
    .select('id');

  if (error) {
    logError(
      'licensing:reinstateLicensesForSale',
      `update refused for sale ${saleId} (reason: ${reason}): ${error.message || error}`
    );
    return 0;
  }

  for (const row of data ?? []) {
    const { error: eventError } = await sb.from('hb_license_events').insert({
      license_id: row.id,
      event: 'reinstate',
      detail: { reason, revoked_for: revokedFor, sale_id: saleId },
    });
    if (eventError) {
      // The license is already active again at this point -- only the audit
      // trail is missing, so this must not change the count returned. Note that
      // an unapplied migrations/20260731_license_event_reinstate.sql surfaces
      // exactly here, as a check-constraint violation on `event`.
      logError(
        'licensing:reinstateLicensesForSale',
        `hb_license_events insert refused for license ${row.id}, sale ${saleId}: ${eventError.message || eventError}`
      );
    }
  }
  return (data ?? []).length;
}
