import { randomBytes } from 'node:crypto';

/** Alphabet sans caractères ambigus : ni 0/O, ni 1/I/L. 31 symboles. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LIMIT = 248; // 31 × 8 — au-delà, l'octet est rejeté pour éviter le biais du modulo

/**
 * Génère une clé de licence au format HB-XXXX-XXXX-XXXX-XXXX (~78 bits).
 * @param {(n: number) => Uint8Array} randomBytesFn source d'aléa, injectable pour les tests
 * @returns {string}
 */
export function generateLicenseKey(randomBytesFn = randomBytes) {
  const chars = [];
  while (chars.length < 16) {
    for (const b of randomBytesFn(24)) {
      if (b >= LIMIT) continue;
      chars.push(ALPHABET[b % ALPHABET.length]);
      if (chars.length === 16) break;
    }
  }
  return 'HB-' + chars.join('').match(/.{4}/g).join('-');
}
