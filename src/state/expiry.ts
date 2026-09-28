import { Obscura } from '../native/ObscuraModule';
import {
  EPHEMERAL_MODELS, ERASED_MODEL, ERASED_MARKER_TTL_MS, erasedKey, isExpired,
} from '../domain/expiry';
import { SEEN_MODEL, indexReceipts, seenEntryId, viewedAtFor } from '../domain/seen';
import { withEntryLock } from './entryLock';
import { logError } from '../utils/log';

type Parsed = { id: string; data: Record<string, unknown>; sentAt: number };

async function readModel(model: string): Promise<Parsed[]> {
  const rows: Parsed[] = [];
  for (const e of await Obscura.entryAll(model)) {
    try {
      rows.push({ id: e.id, data: JSON.parse(e.data) as Record<string, unknown>, sentAt: e.sentAt });
    } catch {
      continue; // `loadEntries` already logs unreadable rows.
    }
  }
  return rows;
}

/** Leave the marker first, so a crash between the two never leaves an erased entry unmarked. */
async function eraseWithMarker(model: string, id: string, now: number): Promise<void> {
  await Obscura.entryPut(ERASED_MODEL, erasedKey(model, id), '{}', now, '');
  await Obscura.entryErase(model, id);
}

/**
 * Erase every seen entry whose ephemeral window has passed (`domain/expiry.ts`), together with its
 * seen receipt.
 *
 * Runs under the entry lock so a drain or write cannot interleave with it. Each erased entry leaves
 * a local marker in `ERASED_MODEL`, so a late or replayed write for it is not stored again.
 * Receipts whose entry never arrived are dropped once they are older than the marker TTL, and
 * markers older than that TTL are pruned.
 *
 * Returns the models it erased from, so the caller can refresh them.
 */
export async function sweepExpired(now: number = Date.now()): Promise<string[]> {
  return withEntryLock(async () => {
    const touched = new Set<string>();
    const seen = await readModel(SEEN_MODEL);
    const receipts = indexReceipts(seen);
    const live = new Set<string>();

    for (const model of EPHEMERAL_MODELS) {
      for (const entry of await readModel(model)) {
        const receiptId = seenEntryId(model, entry.id);
        live.add(receiptId);
        if (!isExpired(viewedAtFor(model, entry, receipts), now)) continue;
        await eraseWithMarker(model, entry.id, now);
        await eraseWithMarker(SEEN_MODEL, receiptId, now);
        touched.add(model);
        touched.add(SEEN_MODEL);
      }
    }

    for (const receipt of seen) {
      if (!live.has(receipt.id) && receipt.sentAt + ERASED_MARKER_TTL_MS <= now) {
        await Obscura.entryErase(SEEN_MODEL, receipt.id);
        touched.add(SEEN_MODEL);
      }
    }

    for (const marker of await Obscura.entryAll(ERASED_MODEL)) {
      if (marker.sentAt + ERASED_MARKER_TTL_MS <= now) {
        await Obscura.entryErase(ERASED_MODEL, marker.id);
      }
    }
    return [...touched];
  }).catch((e) => {
    logError('expiry.sweep', e);
    return [];
  });
}
