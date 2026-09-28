import { Obscura } from '../native/ObscuraModule';
import {
  EPHEMERAL_MODELS, ERASED_MODEL, ERASED_MARKER_TTL_MS, erasedKey, isExpired,
} from '../domain/expiry';
import { withEntryLock } from './entryLock';
import { logError } from '../utils/log';

/**
 * Erase every seen entry whose ephemeral window has passed (`domain/expiry.ts`).
 *
 * Runs under the entry lock so a drain or write cannot interleave with it. Each erased entry
 * leaves a local marker in `ERASED_MODEL` before it is erased, so a crash between the two leaves
 * a marker for an entry that still exists (retried next sweep) rather than an erased entry with
 * no marker (which a late write could resurrect). Markers older than `ERASED_MARKER_TTL_MS` are
 * pruned.
 *
 * Returns the models it erased from, so the caller can refresh them.
 */
export async function sweepExpired(now: number = Date.now()): Promise<string[]> {
  return withEntryLock(async () => {
    const touched: string[] = [];
    for (const model of EPHEMERAL_MODELS) {
      let erasedAny = false;
      for (const e of await Obscura.entryAll(model)) {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(e.data) as Record<string, unknown>;
        } catch {
          continue; // `loadEntries` already logs unreadable rows.
        }
        if (!isExpired(data, e.sentAt, now)) continue;
        await Obscura.entryPut(ERASED_MODEL, erasedKey(model, e.id), '{}', now, '');
        await Obscura.entryErase(model, e.id);
        erasedAny = true;
      }
      if (erasedAny) touched.push(model);
    }

    for (const marker of await Obscura.entryAll(ERASED_MODEL)) {
      if (marker.sentAt + ERASED_MARKER_TTL_MS <= now) {
        await Obscura.entryErase(ERASED_MODEL, marker.id);
      }
    }
    return touched;
  }).catch((e) => {
    logError('expiry.sweep', e);
    return [];
  });
}
