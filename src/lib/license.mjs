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
