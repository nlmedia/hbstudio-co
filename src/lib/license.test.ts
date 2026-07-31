import { describe, it, expect } from 'vitest';
import { generateLicenseKey, seatsForTier, updatesUntilFrom, hasActiveUpdates, canDownloadVersion } from './license.mjs';

describe('generateLicenseKey', () => {
  it('produces the HB-XXXX-XXXX-XXXX-XXXX format', () => {
    expect(generateLicenseKey()).toMatch(/^HB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('never uses the ambiguous characters 0 O 1 I L', () => {
    const keys = Array.from({ length: 200 }, () => generateLicenseKey()).join('');
    expect(keys).not.toMatch(/[01OIL]/);
  });

  it('rejects bytes that would bias the modulo', () => {
    // Bytes 248..255 must be discarded: otherwise the first 5 characters of
    // the alphabet would come up more often than the others.
    const feed = [248, 249, 250, 251, 252, 253, 254, 255, ...Array(32).fill(0)];
    let i = 0;
    const fakeRandomBytes = (n: number) =>
      Uint8Array.from({ length: n }, () => feed[i++] ?? 0);
    expect(generateLicenseKey(fakeRandomBytes)).toBe('HB-AAAA-AAAA-AAAA-AAAA');
  });

  it('produces distinct keys', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateLicenseKey()));
    expect(set.size).toBe(500);
  });

  it('throws instead of looping forever when the random source never yields an accepted byte', () => {
    const alwaysRejected = (n: number) => Uint8Array.from({ length: n }, () => 250);
    expect(() => generateLicenseKey(alwaysRejected)).toThrow();
  });

  it('throws instead of looping forever when the random source yields empty arrays', () => {
    const empty = () => new Uint8Array(0);
    expect(() => generateLicenseKey(empty)).toThrow();
  });
});

describe('seatsForTier', () => {
  it('gives 1 seat for single and 5 for extended', () => {
    expect(seatsForTier('single')).toBe(1);
    expect(seatsForTier('extended')).toBe(5);
  });

  it('rejects an unknown tier', () => {
    expect(() => seatsForTier('all-access')).toThrow('Unknown tier: all-access');
  });
});

describe('updatesUntilFrom', () => {
  it('adds 12 months to the purchase date', () => {
    expect(updatesUntilFrom('2026-07-31T10:00:00.000Z')).toBe('2027-07-31T10:00:00.000Z');
  });

  it('handles February 29th without producing an invalid date', () => {
    expect(updatesUntilFrom('2028-02-29T10:00:00.000Z')).toBe('2029-03-01T10:00:00.000Z');
  });
});

describe('hasActiveUpdates', () => {
  const now = new Date('2026-07-31T00:00:00.000Z');

  it('is true for an active, non-expired license', () => {
    expect(hasActiveUpdates({ status: 'active', updates_until: '2027-01-01T00:00:00.000Z' }, now)).toBe(true);
  });

  it('is false once the updates date has passed', () => {
    expect(hasActiveUpdates({ status: 'active', updates_until: '2026-01-01T00:00:00.000Z' }, now)).toBe(false);
  });

  it('is false for a revoked license even within the window', () => {
    expect(hasActiveUpdates({ status: 'revoked', updates_until: '2027-01-01T00:00:00.000Z' }, now)).toBe(false);
  });
});

describe('canDownloadVersion', () => {
  const expired = { status: 'active', updates_until: '2026-01-01T00:00:00.000Z' };

  it('allows a version released during the entitlement period', () => {
    expect(canDownloadVersion(expired, { released_at: '2025-12-25T00:00:00.000Z' })).toBe(true);
  });

  it('refuses a version released after entitlement ended', () => {
    expect(canDownloadVersion(expired, { released_at: '2026-03-01T00:00:00.000Z' })).toBe(false);
  });

  it('allows a version released exactly at the entitlement deadline', () => {
    expect(canDownloadVersion(expired, { released_at: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('refuses everything for a revoked license', () => {
    expect(canDownloadVersion({ status: 'revoked', updates_until: '2027-01-01T00:00:00.000Z' },
      { released_at: '2026-01-01T00:00:00.000Z' })).toBe(false);
  });
});
