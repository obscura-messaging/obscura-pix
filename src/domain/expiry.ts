/**
 * Ephemeral messages: what expires, and when.
 *
 * A direct message or pix is erased from a device 15 minutes after it was **seen by its
 * recipient**. The recipient's seen receipt (`domain/seen.ts`) reaches every device that holds the
 * entry (the sender's included), so each device runs the same clock and erases its own copy.
 * Nothing is synced as a delete; the receipt is the only signal.
 *
 * Pure: no bridge, no clock of its own. `state/expiry.ts` applies it.
 */

/** Models whose entries are erased after being seen. */
export const EPHEMERAL_MODELS = ['directMessage', 'pix'] as const;

/** How long a seen entry survives. */
export const EXPIRE_AFTER_MS = 15 * 60 * 1000;

/**
 * Local-only model listing erased entries, so a late or replayed write for the same id is not
 * stored again. Not in the schema: it is never sent and never rendered.
 */
export const ERASED_MODEL = '_erased';

/** How long an erased marker is kept. Longer than any realistic redelivery. */
export const ERASED_MARKER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function erasedKey(model: string, id: string): string {
  return `${model}:${id}`;
}

/**
 * Whether an entry seen at `viewedAt` (from `domain/seen.ts`, already capped) has expired.
 * An unseen entry (`null`) never expires.
 */
export function isExpired(viewedAt: number | null, now: number): boolean {
  return viewedAt !== null && viewedAt + EXPIRE_AFTER_MS <= now;
}
