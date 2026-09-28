import { sweepExpired } from '../expiry';
import { drainInbox } from '../drainInbox';
import { Obscura } from '../../native/ObscuraModule';
import { getFakeBridge } from '../../native/__fixtures__/reactNativeMock';
import { ERASED_MODEL, ERASED_MARKER_TTL_MS, EXPIRE_AFTER_MS } from '../../domain/expiry';
import { SEEN_MODEL, seenEntryId } from '../../domain/seen';

/**
 * The ephemeral sweep end to end against the in-memory kit double: what gets erased, the receipt
 * and marker handling, and that the drain honours the marker.
 */

const bridge = getFakeBridge();

const SELF = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const CONV = [SELF, PEER].sort().join('_');
const NOW = 10_000_000;
const LONG_AGO = NOW - EXPIRE_AFTER_MS - 1;

beforeEach(() => {
  bridge.__authenticate({ userId: SELF });
});

/** An entry authored by SELF. */
function put(model: string, id: string, sentAt = 1) {
  return Obscura.entryPut(
    model, id, JSON.stringify({ conversationId: CONV, content: id, _authorUserId: SELF }), sentAt, 'd',
  );
}

/** PEER's seen receipt for one of SELF's entries. */
function seenByPeer(model: string, id: string, viewedAt: number) {
  return Obscura.entryPut(
    SEEN_MODEL, seenEntryId(model, id),
    JSON.stringify({ conversationId: CONV, model, entryId: id, viewedAt, _authorUserId: PEER }),
    viewedAt, 'd_peer',
  );
}

async function ids(model: string): Promise<string[]> {
  return (await Obscura.entryAll(model)).map((e) => e.id).sort();
}

describe('sweepExpired', () => {
  it('erases DMs and pix seen more than 15 minutes ago, with their receipts, and keeps the rest', async () => {
    await put('directMessage', 'dm_expired');
    await seenByPeer('directMessage', 'dm_expired', LONG_AGO);
    await put('directMessage', 'dm_recent');
    await seenByPeer('directMessage', 'dm_recent', NOW - 1_000);
    await put('directMessage', 'dm_unseen');
    await Obscura.entryPut(
      'pix', 'pix_expired',
      JSON.stringify({ conversationId: CONV, mediaRef: 'att_expired', _authorUserId: SELF }), 1, 'd',
    );
    await seenByPeer('pix', 'pix_expired', LONG_AGO);
    await Obscura.entryPut(
      'pix', 'pix_unseen',
      JSON.stringify({ conversationId: CONV, mediaRef: 'att_unseen', _authorUserId: SELF }), 1, 'd',
    );

    const touched = await sweepExpired(NOW);

    expect(touched.sort()).toEqual(['directMessage', 'pix', SEEN_MODEL]);
    expect(await ids('directMessage')).toEqual(['dm_recent', 'dm_unseen']);
    expect(await ids('pix')).toEqual(['pix_unseen']);
    expect(bridge.__purged).toEqual(['att_expired']);
    expect(await ids(SEEN_MODEL)).toEqual([seenEntryId('directMessage', 'dm_recent')]);
    expect(await ids(ERASED_MODEL)).toEqual([
      'directMessage:dm_expired',
      'pix:pix_expired',
      `${SEEN_MODEL}:${seenEntryId('directMessage', 'dm_expired')}`,
      `${SEEN_MODEL}:${seenEntryId('pix', 'pix_expired')}`,
    ].sort());
  });

  it('does not expire an entry on a receipt its own author wrote', async () => {
    await put('directMessage', 'dm_1');
    await Obscura.entryPut(
      SEEN_MODEL, seenEntryId('directMessage', 'dm_1'),
      JSON.stringify({ conversationId: CONV, model: 'directMessage', entryId: 'dm_1', viewedAt: LONG_AGO, _authorUserId: SELF }),
      LONG_AGO, 'd',
    );

    expect(await sweepExpired(NOW)).toEqual([]);
    expect(await ids('directMessage')).toEqual(['dm_1']);
  });

  it('drops receipts whose entry never arrived, once they outlive the marker TTL', async () => {
    await seenByPeer('directMessage', 'never_arrived', NOW - ERASED_MARKER_TTL_MS);
    await seenByPeer('directMessage', 'still_coming', NOW - 1);

    await sweepExpired(NOW);

    expect(await ids(SEEN_MODEL)).toEqual([seenEntryId('directMessage', 'still_coming')]);
  });

  it('prunes erased markers after their TTL', async () => {
    await Obscura.entryPut(ERASED_MODEL, 'directMessage:old', '{}', NOW - ERASED_MARKER_TTL_MS, '');
    await Obscura.entryPut(ERASED_MODEL, 'directMessage:new', '{}', NOW - 1, '');

    await sweepExpired(NOW);

    expect(await ids(ERASED_MODEL)).toEqual(['directMessage:new']);
  });

  /** The resurrection case: the message, or its receipt, replayed after the erase. */
  it('keeps an erased message and its receipt erased when they are delivered again', async () => {
    await put('directMessage', 'dm_1');
    await seenByPeer('directMessage', 'dm_1', LONG_AGO);
    await sweepExpired(NOW);

    bridge.__deliverInbox({
      senderUserId: PEER, modelKey: 'directMessage', entryId: 'dm_1', sentAt: NOW + 5,
      payload: JSON.stringify({ conversationId: CONV, content: 'dm_1' }),
    });
    bridge.__deliverInbox({
      senderUserId: PEER, modelKey: SEEN_MODEL, entryId: seenEntryId('directMessage', 'dm_1'), sentAt: NOW + 6,
      payload: JSON.stringify({ conversationId: CONV, model: 'directMessage', entryId: 'dm_1', viewedAt: NOW }),
    });
    const result = await drainInbox();

    expect(result).toMatchObject({ written: 0, consumed: 2 });
    expect(await ids('directMessage')).toEqual([]);
    expect(await ids(SEEN_MODEL)).toEqual([]);
  });
});
