import { Obscura } from '../native/ObscuraModule';
import {
  EPHEMERAL_MODELS, ERASED_MODEL, MAX_AGE_MS, erasedKey, expiresAt,
} from '../domain/expiry';
import { SEEN_MODEL, indexReceipts, seenEntryId, viewedAtFor } from '../domain/seen';
import { withEntryLock } from './entryLock';
import { readEntries } from './readEntries';
import { logError } from '../utils/log';

/** The marker goes first, so a crash between the two never leaves an erased entry unmarked. */
async function eraseWithMarker(model: string, id: string, now: number): Promise<void> {
  await Obscura.entryPut(ERASED_MODEL, erasedKey(model, id), '{}', now, '');
  await Obscura.entryErase(model, id);
}

/**
 * Erase every expired ephemeral entry with its receipt and decrypted media, drop receipts whose
 * entry never arrived, and prune old erased markers. Returns the models it changed.
 */
export async function sweepExpired(now: number = Date.now()): Promise<string[]> {
  return withEntryLock(async () => {
    const touched = new Set<string>();
    const receiptRows = await readEntries(SEEN_MODEL);
    const receipts = indexReceipts(receiptRows);
    const live = new Set<string>();

    for (const model of EPHEMERAL_MODELS) {
      for (const entry of await readEntries(model)) {
        const receiptId = seenEntryId(model, entry.id);
        live.add(receiptId);
        if (expiresAt(entry.sentAt, viewedAtFor(model, entry, receipts)) > now) continue;
        // Media first: once the entry is gone, nothing records which attachment it used.
        if (typeof entry.data.mediaRef === 'string') await Obscura.purgeAttachment(entry.data.mediaRef);
        await eraseWithMarker(model, entry.id, now);
        if (receipts.has(receiptId)) await eraseWithMarker(SEEN_MODEL, receiptId, now);
        touched.add(model);
      }
    }

    for (const receipt of receiptRows) {
      if (!live.has(receipt.id) && receipt.sentAt + MAX_AGE_MS <= now) {
        await Obscura.entryErase(SEEN_MODEL, receipt.id);
      }
    }

    for (const marker of await Obscura.entryAll(ERASED_MODEL)) {
      if (marker.sentAt + MAX_AGE_MS <= now) await Obscura.entryErase(ERASED_MODEL, marker.id);
    }
    return [...touched];
  }).catch((e) => {
    logError('expiry.sweep', e);
    return [];
  });
}
