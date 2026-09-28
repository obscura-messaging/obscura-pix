import { EXPIRE_AFTER_MS, erasedKey, isExpired } from '../expiry';

/** When a seen entry expires (`domain/expiry.ts`). `viewedAt` comes from `domain/seen.ts`. */
describe('isExpired', () => {
  it('never expires an unseen entry', () => {
    expect(isExpired(null, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('flips exactly 15 minutes after the entry was seen', () => {
    expect(isExpired(1_000, 1_000 + EXPIRE_AFTER_MS - 1)).toBe(false);
    expect(isExpired(1_000, 1_000 + EXPIRE_AFTER_MS)).toBe(true);
  });
});

describe('erasedKey', () => {
  it('distinguishes the same id in different models', () => {
    expect(erasedKey('pix', 'x')).not.toBe(erasedKey('directMessage', 'x'));
  });
});
