import { describe, it, expect } from 'vitest';
import { generateLicenseKey } from './license.mjs';

describe('generateLicenseKey', () => {
  it('produit le format HB-XXXX-XXXX-XXXX-XXXX', () => {
    expect(generateLicenseKey()).toMatch(/^HB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("n'utilise jamais les caractères ambigus 0 O 1 I L", () => {
    const keys = Array.from({ length: 200 }, () => generateLicenseKey()).join('');
    expect(keys).not.toMatch(/[01OIL]/);
  });

  it('rejette les octets qui biaiseraient le modulo', () => {
    // 248..255 doivent être ignorés : sinon les 5 premiers caractères de
    // l'alphabet sortiraient plus souvent que les autres.
    const feed = [248, 249, 250, 251, 252, 253, 254, 255, ...Array(32).fill(0)];
    let i = 0;
    const fakeRandomBytes = (n: number) =>
      Uint8Array.from({ length: n }, () => feed[i++] ?? 0);
    expect(generateLicenseKey(fakeRandomBytes)).toBe('HB-AAAA-AAAA-AAAA-AAAA');
  });

  it('produit des clés distinctes', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateLicenseKey()));
    expect(set.size).toBe(500);
  });
});
