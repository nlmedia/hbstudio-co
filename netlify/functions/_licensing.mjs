import { generateLicenseKey, seatsForTier, updatesUntilFrom } from '../../src/lib/license.mjs';
import { logError } from './_lib.mjs';

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
