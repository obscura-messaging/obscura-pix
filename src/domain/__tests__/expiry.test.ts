import { EXPIRE_AFTER_MS, erasedKey, expiresAt, isExpired } from '../expiry';

/**
 * When a seen message expires (`domain/expiry.ts`). The clock starts at the recipient's `viewedAt`,
 * and `viewedAt` is capped at the entry's clamped `sentAt` because it comes from another device.
 */
describe('expiresAt', () => {
  it('is null until the entry has been seen', () => {
    expect(expiresAt({ content: 'hi' }, 1_000)).toBeNull();
    expect(expiresAt({ viewedAt: 'soon' }, 1_000)).toBeNull();
    expect(expiresAt({ viewedAt: Number.NaN }, 1_000)).toBeNull();
  });

  it('is 15 minutes after the recipient saw it', () => {
    expect(expiresAt({ viewedAt: 5_000 }, 5_000)).toBe(5_000 + EXPIRE_AFTER_MS);
  });

  it('caps a future-dated viewedAt at the entry sentAt, so a peer cannot extend it', () => {
    expect(expiresAt({ viewedAt: 9_999_999_999 }, 5_000)).toBe(5_000 + EXPIRE_AFTER_MS);
  });
});

describe('isExpired', () => {
  it('flips exactly at the deadline', () => {
    const data = { viewedAt: 1_000 };
    expect(isExpired(data, 1_000, 1_000 + EXPIRE_AFTER_MS - 1)).toBe(false);
    expect(isExpired(data, 1_000, 1_000 + EXPIRE_AFTER_MS)).toBe(true);
  });

  it('never expires an unseen entry', () => {
    expect(isExpired({ content: 'hi' }, 0, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('erasedKey', () => {
  it('distinguishes the same id in different models', () => {
    expect(erasedKey('pix', 'x')).not.toBe(erasedKey('directMessage', 'x'));
  });
});
