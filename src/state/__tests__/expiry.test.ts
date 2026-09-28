import { sweepExpired } from '../expiry';
import { drainInbox } from '../drainInbox';
import { Obscura } from '../../native/ObscuraModule';
import { getFakeBridge } from '../../native/__fixtures__/reactNativeMock';
import { ERASED_MODEL, ERASED_MARKER_TTL_MS, EXPIRE_AFTER_MS } from '../../domain/expiry';

/**
 * The ephemeral sweep end to end against the in-memory kit double: what gets erased, the marker it
 * leaves, and that the drain honours the marker.
 */

const bridge = getFakeBridge();

const SELF = '11111111-1111-4111-8111-111111111111';
const PEER = '22222222-2222-4222-8222-222222222222';
const CONV = [SELF, PEER].sort().join('_');
const NOW = 10_000_000;

beforeEach(() => {
  bridge.__authenticate({ userId: SELF });
});

function put(model: string, id: string, data: Record<string, unknown>, sentAt: number) {
  return Obscura.entryPut(model, id, JSON.stringify({ conversationId: CONV, ...data }), sentAt, 'd');
}

async function ids(model: string): Promise<string[]> {
  return (await Obscura.entryAll(model)).map((e) => e.id).sort();
}

describe('sweepExpired', () => {
  it('erases seen DMs and pix past their window and keeps everything else', async () => {
    const seenLongAgo = NOW - EXPIRE_AFTER_MS - 1;
    await put('directMessage', 'dm_expired', { content: 'a', viewedAt: seenLongAgo }, seenLongAgo);
    await put('directMessage', 'dm_recent', { content: 'b', viewedAt: NOW - 1_000 }, NOW - 1_000);
    await put('directMessage', 'dm_unseen', { content: 'c' }, 1);
    await put('pix', 'pix_expired', { viewedAt: seenLongAgo }, seenLongAgo);
    await Obscura.entryPut('story', 'story_1', JSON.stringify({ viewedAt: 1 }), 1, 'd');

    const touched = await sweepExpired(NOW);

    expect(touched.sort()).toEqual(['directMessage', 'pix']);
    expect(await ids('directMessage')).toEqual(['dm_recent', 'dm_unseen']);
    expect(await ids('pix')).toEqual([]);
    expect(await ids('story')).toEqual(['story_1']);
    expect(await ids(ERASED_MODEL)).toEqual(['directMessage:dm_expired', 'pix:pix_expired']);
  });

  it('reports nothing when nothing expired', async () => {
    await put('directMessage', 'dm_unseen', { content: 'c' }, 1);

    expect(await sweepExpired(NOW)).toEqual([]);
    expect(await ids(ERASED_MODEL)).toEqual([]);
  });

  it('prunes erased markers after their TTL', async () => {
    await Obscura.entryPut(ERASED_MODEL, 'directMessage:old', '{}', NOW - ERASED_MARKER_TTL_MS, '');
    await Obscura.entryPut(ERASED_MODEL, 'directMessage:new', '{}', NOW - 1, '');

    await sweepExpired(NOW);

    expect(await ids(ERASED_MODEL)).toEqual(['directMessage:new']);
  });

  /** The resurrection case: a late seen receipt from the recipient's other device. */
  it('keeps an erased message erased when a late write for it arrives', async () => {
    const seenLongAgo = NOW - EXPIRE_AFTER_MS - 1;
    await put('directMessage', 'dm_1', { content: 'secret', viewedAt: seenLongAgo }, seenLongAgo);
    await sweepExpired(NOW);

    bridge.__deliverInbox({
      senderUserId: PEER,
      modelKey: 'directMessage',
      entryId: 'dm_1',
      sentAt: NOW + 5,
      payload: JSON.stringify({ conversationId: CONV, content: 'secret', viewedAt: NOW }),
    });
    const result = await drainInbox();

    expect(result).toMatchObject({ written: 0, consumed: 1 });
    expect(await ids('directMessage')).toEqual([]);
  });
});
