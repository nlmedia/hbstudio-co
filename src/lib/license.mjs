import { randomBytes } from 'node:crypto';

/** Alphabet without ambiguous characters: no 0/O, no 1/I/L. 31 symbols. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LIMIT = 248; // 31 × 8 — bytes at or above this are discarded to avoid modulo bias
const MAX_ATTEMPTS = 32; // 24 bytes per call, ~8/256 rejection rate — 32 attempts is a very generous bound

/**
 * Generates a license key in the HB-XXXX-XXXX-XXXX-XXXX format (16 × log2(31) ≈ 79.3 bits).
 * @param {(n: number) => Uint8Array} randomBytesFn source of randomness, injectable for tests
 * @returns {string}
 */
export function generateLicenseKey(randomBytesFn = randomBytes) {
  const chars = [];
  let attempts = 0;
  while (chars.length < 16) {
    if (attempts++ >= MAX_ATTEMPTS) {
      throw new Error('generateLicenseKey: failed to gather enough unbiased random bytes');
    }
    for (const b of randomBytesFn(24)) {
      if (b >= LIMIT) continue;
      chars.push(ALPHABET[b % ALPHABET.length]);
      if (chars.length === 16) break;
    }
  }
  return 'HB-' + chars.join('').match(/.{4}/g).join('-');
}

/** @typedef {{ status: string, updates_until: string }} License */
/** @typedef {{ released_at: string }} TemplateVersion */

/** Number of sites allowed per tier. Locked into the license at purchase time. */
export const SEATS_BY_TIER = { single: 1, extended: 5 };

/**
 * @param {string} tier
 * @returns {number}
 */
export function seatsForTier(tier) {
  const seats = SEATS_BY_TIER[tier];
  if (!seats) throw new Error(`Unknown tier: ${tier}`);
  return seats;
}

/**
 * End of update entitlement: 12 months after purchase.
 * @param {string | Date} purchasedAt
 * @returns {string} ISO 8601
 */
export function updatesUntilFrom(purchasedAt) {
  const d = new Date(purchasedAt);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/**
 * Does the license currently entitle its holder to updates?
 * @param {License} license
 * @param {Date} [now]
 * @returns {boolean}
 */
export function hasActiveUpdates(license, now = new Date()) {
  return license.status === 'active' && new Date(license.updates_until) > now;
}

/**
 * Is this version downloadable? An expired license keeps access to versions
 * released DURING its entitlement period, and to nothing more.
 * @param {License} license
 * @param {TemplateVersion} version
 * @returns {boolean}
 */
export function canDownloadVersion(license, version) {
  if (license.status !== 'active') return false;
  return new Date(version.released_at) <= new Date(license.updates_until);
}
