import { describe, it, expect } from 'vitest';
import { generateLicenseKey } from './license.mjs';

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
