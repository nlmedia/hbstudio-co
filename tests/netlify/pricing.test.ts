import { describe, it, expect } from 'vitest';
import { resolveAmount } from '../../netlify/functions/_pricing.mjs';

const now = new Date('2026-07-31T00:00:00.000Z');
const base = {
  status: 'published',
  title: 'Atelier',
  cms: 'shopify',
  price: 69,
  sale_price: null,
  sale_ends_at: null,
  extended_price: 149,
};

describe('resolveAmount', () => {
  it('charges the single price in cents', () => {
    expect(resolveAmount(base, 'single', now)).toBe(6900);
  });

  it('charges the extended price in cents', () => {
    expect(resolveAmount(base, 'extended', now)).toBe(14900);
  });

  it('applies an ongoing sale on the single tier', () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-08-31T00:00:00.000Z' };
    expect(resolveAmount(t, 'single', now)).toBe(4900);
  });

  it('ignores an expired sale', () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-06-01T00:00:00.000Z' };
    expect(resolveAmount(t, 'single', now)).toBe(6900);
  });

  it('does not apply the sale to the extended tier', () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-08-31T00:00:00.000Z' };
    expect(resolveAmount(t, 'extended', now)).toBe(14900);
  });

  it('refuses an unpublished template', () => {
    expect(resolveAmount({ ...base, status: 'draft' }, 'single', now)).toBeNull();
  });

  it('refuses the extended tier when no extended price is set', () => {
    expect(resolveAmount({ ...base, extended_price: null }, 'extended', now)).toBeNull();
  });

  it('refuses an unknown tier', () => {
    expect(resolveAmount(base, 'all-access', now)).toBeNull();
  });

  it('refuses a missing template', () => {
    expect(resolveAmount(null, 'single', now)).toBeNull();
  });

  it('refuses a zero single price', () => {
    expect(resolveAmount({ ...base, price: 0 }, 'single', now)).toBeNull();
  });

  it('refuses a negative single price', () => {
    expect(resolveAmount({ ...base, price: -10 }, 'single', now)).toBeNull();
  });

  it('refuses a zero extended price', () => {
    expect(resolveAmount({ ...base, extended_price: 0 }, 'extended', now)).toBeNull();
  });

  it('refuses a negative extended price', () => {
    expect(resolveAmount({ ...base, extended_price: -1 }, 'extended', now)).toBeNull();
  });

  it('refuses a non-numeric single price', () => {
    expect(resolveAmount({ ...base, price: 'gratuit' }, 'single', now)).toBeNull();
  });

  it('refuses a sale that brings the amount down to zero', () => {
    const t = { ...base, sale_price: 0, sale_ends_at: '2026-08-31T00:00:00.000Z' };
    expect(resolveAmount(t, 'single', now)).toBeNull();
  });

  it('still accepts a sub-1-euro price', () => {
    expect(resolveAmount({ ...base, price: 0.5 }, 'single', now)).toBe(50);
  });
});
