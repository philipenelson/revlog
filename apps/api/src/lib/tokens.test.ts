import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { generateRefreshToken, hashRefreshToken } from './tokens';

describe('generateRefreshToken', () => {
  it('returns a 64-character hex raw token (32 bytes)', () => {
    const { raw } = generateRefreshToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is the SHA-256 of the raw token', () => {
    const { raw, hash } = generateRefreshToken();
    const expected = createHash('sha256').update(raw).digest('hex');
    expect(hash).toBe(expected);
  });

  it('produces different tokens on consecutive calls', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('hashRefreshToken', () => {
  it('produces the same result as the hash from generateRefreshToken', () => {
    const { raw, hash } = generateRefreshToken();
    expect(hashRefreshToken(raw)).toBe(hash);
  });

  it('is deterministic — same input always yields same hash', () => {
    const { raw } = generateRefreshToken();
    expect(hashRefreshToken(raw)).toBe(hashRefreshToken(raw));
  });
});
