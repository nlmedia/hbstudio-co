import { generateLicenseKey, seatsForTier, updatesUntilFrom } from '../../src/lib/license.mjs';

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
  if (!template) return null;

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

  if (error) return null;
  return data;
}

/**
 * Revokes every license attached to a sale (refund, chargeback).
 * @returns {Promise<number>} number of licenses revoked
 */
export async function revokeLicensesForSale(sb, saleId, reason) {
  if (!sb || !saleId) return 0;

  const { data } = await sb
    .from('hb_licenses')
    .update({ status: 'revoked' })
    .eq('sale_id', saleId)
    .eq('status', 'active')
    .select('id');

  for (const row of data ?? []) {
    await sb.from('hb_license_events').insert({
      license_id: row.id,
      event: 'revoke',
      detail: { reason, sale_id: saleId },
    });
  }
  return (data ?? []).length;
}
