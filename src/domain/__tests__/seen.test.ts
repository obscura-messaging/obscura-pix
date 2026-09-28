import { indexReceipts, seenEntryId, viewedAtFor } from '../seen';

/**
 * Seen receipts (`domain/seen.ts`). What matters is who may mark what: only the other participant,
 * only in the same conversation, and never later than the receipt was sent.
 */
const ALICE = 'uAlice';
const BOB = 'uBob';
const CONV = [ALICE, BOB].sort().join('_');

const message = { id: 'dm_1', data: { conversationId: CONV, content: 'hi', _authorUserId: ALICE } };

function receipt(over: Record<string, unknown> = {}, sentAt = 5_000, id = seenEntryId('directMessage', 'dm_1')) {
  return {
    id,
    sentAt,
    data: { conversationId: CONV, model: 'directMessage', entryId: 'dm_1', viewedAt: 4_000, _authorUserId: BOB, ...over },
  };
}

describe('viewedAtFor', () => {
  it('is null without a receipt', () => {
    expect(viewedAtFor('directMessage', message, indexReceipts([]))).toBeNull();
  });

  it('uses the recipient receipt', () => {
    expect(viewedAtFor('directMessage', message, indexReceipts([receipt()]))).toBe(4_000);
  });

  it('ignores a receipt written by the entry author, so a sender cannot mark their own message seen', () => {
    expect(viewedAtFor('directMessage', message, indexReceipts([receipt({ _authorUserId: ALICE })]))).toBeNull();
  });

  it('ignores a receipt naming a different conversation', () => {
    expect(viewedAtFor('directMessage', message, indexReceipts([receipt({ conversationId: 'uBob_uEve' })]))).toBeNull();
  });

  it('caps a future-dated viewedAt at the receipt sentAt', () => {
    expect(viewedAtFor('directMessage', message, indexReceipts([receipt({ viewedAt: 9_999_999 }, 5_000)]))).toBe(5_000);
  });

  it('does not apply a pix receipt to a message with the same id', () => {
    const pixReceipt = receipt({ model: 'pix' }, 5_000, seenEntryId('pix', 'dm_1'));
    expect(viewedAtFor('directMessage', message, indexReceipts([pixReceipt]))).toBeNull();
  });
});

describe('indexReceipts', () => {
  it('skips malformed receipts and ones whose id does not match their target', () => {
    const index = indexReceipts([
      receipt({ viewedAt: 'soon' }),
      receipt({}, 5_000, 'seen_directMessage_other'),
    ]);
    expect(index.size).toBe(0);
  });
});
