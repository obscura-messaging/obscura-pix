/**
 * Ephemeral messages: what expires, and when.
 *
 * A direct message or pix is erased from a device 15 minutes after it was **seen by its
 * recipient**. The recipient's `viewedAt` receipt reaches every device that holds the entry (the
 * sender's included), so each device runs the same clock and erases its own copy. Nothing is
 * synced as a delete; the receipt is the only signal.
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
 * When an entry expires, or `null` if it has not been seen.
 *
 * `viewedAt` is written by the recipient's device, so it is capped at the entry's `sentAt`. For
 * the receipt write that is the moment it was written, and on receipt the kit clamps a peer's
 * `sentAt` to at most 60s past arrival (NATIVE_CONTRACT §2.4). So a future-dated `viewedAt` cannot
 * extend a message's life on this device.
 */
export function expiresAt(data: Record<string, unknown>, sentAt: number): number | null {
  const viewedAt = data.viewedAt;
  if (typeof viewedAt !== 'number' || !Number.isFinite(viewedAt)) return null;
  return Math.min(viewedAt, sentAt) + EXPIRE_AFTER_MS;
}

export function isExpired(data: Record<string, unknown>, sentAt: number, now: number): boolean {
  const at = expiresAt(data, sentAt);
  return at !== null && at <= now;
}
