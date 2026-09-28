/**
 * Seen receipts: who saw which message, and when.
 *
 * A receipt is its own `seen` entry, written by the recipient and sent to both conversation
 * participants. It is APPEND, and the entry it points at stays APPEND too, so neither side can
 * rewrite what the other wrote. (Before receipts, the recipient wrote `viewedAt` back onto the
 * message itself, which let them replace its content.)
 *
 * Pure: no bridge. `state/store.ts` and `state/expiry.ts` apply it.
 */

import { AUTHOR_USER_ID } from '../models/schema';

export const SEEN_MODEL = 'seen';

/** Models that get seen receipts. */
export const RECEIPTED_MODELS = ['directMessage', 'pix'] as const;

/** One receipt per entry, so a repeated receipt is an APPEND duplicate rather than a second row. */
export function seenEntryId(model: string, entryId: string): string {
  return `seen_${model}_${entryId}`;
}

export interface SeenReceipt {
  model: string;
  entryId: string;
  conversationId: string;
  viewedAt: number;
  /** The receipt entry's own (clamped) `sentAt`. */
  sentAt: number;
  author: string;
}

/** Parse stored `seen` entries into receipts keyed by `seenEntryId`. Malformed ones are skipped. */
export function indexReceipts(
  entries: ReadonlyArray<{ id: string; data: Record<string, unknown>; sentAt: number }>,
): Map<string, SeenReceipt> {
  const index = new Map<string, SeenReceipt>();
  for (const { id, data, sentAt } of entries) {
    const { model, entryId, conversationId, viewedAt } = data;
    const author = data[AUTHOR_USER_ID];
    if (
      typeof model !== 'string' || typeof entryId !== 'string' ||
      typeof conversationId !== 'string' || typeof author !== 'string' ||
      typeof viewedAt !== 'number' || !Number.isFinite(viewedAt)
    ) continue;
    if (id !== seenEntryId(model, entryId)) continue;
    index.set(id, { model, entryId, conversationId, viewedAt, sentAt, author });
  }
  return index;
}

/**
 * When the entry was seen by its recipient, or `null`.
 *
 * A receipt counts only if it was written by someone other than the entry's author and names the
 * entry's conversation, so a sender cannot mark their own message seen and a receipt cannot reach
 * across conversations. `viewedAt` comes from the recipient's clock, so it is capped at the
 * receipt's `sentAt`, which the kit clamps to at most 60s past arrival (NATIVE_CONTRACT §2.4).
 */
export function viewedAtFor(
  model: string,
  entry: { id: string; data: Record<string, unknown> },
  receipts: ReadonlyMap<string, SeenReceipt>,
): number | null {
  const receipt = receipts.get(seenEntryId(model, entry.id));
  if (receipt === undefined) return null;
  if (receipt.author === entry.data[AUTHOR_USER_ID]) return null;
  if (receipt.conversationId !== entry.data.conversationId) return null;
  return Math.min(receipt.viewedAt, receipt.sentAt);
}
