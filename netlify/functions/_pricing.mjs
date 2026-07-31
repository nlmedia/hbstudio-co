/**
 * Amount to charge, in cents, for a template at a given license tier.
 * The sale (sale_price / sale_ends_at) only ever applies to the single tier:
 * extended_price is a hand-set price, never derived from the single price.
 *
 * @param {object|null} template hb_templates row
 * @param {string} tier 'single' | 'extended'
 * @param {Date} [now]
 * @returns {number|null} cents, or null if the purchase is not possible
 */
export function resolveAmount(template, tier, now = new Date()) {
  if (!template || template.status !== 'published') return null;

  if (tier === 'single') {
    if (template.price == null) return null;
    const notExpired = !template.sale_ends_at || new Date(template.sale_ends_at) > now;
    const onSale =
      template.sale_price != null &&
      Number(template.sale_price) < Number(template.price) &&
      notExpired;
    return Math.round(Number(onSale ? template.sale_price : template.price) * 100);
  }

  if (tier === 'extended') {
    if (template.extended_price == null) return null;
    return Math.round(Number(template.extended_price) * 100);
  }

  return null;
}

/** Product label shown on the Stripe checkout page. */
export function productLabel(template, tier) {
  const suffix = tier === 'extended' ? 'Extended license — 5 sites' : 'Single license — 1 site';
  return `${template.title} (${template.cms}) — ${suffix}`;
}
