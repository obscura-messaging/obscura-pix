/**
 * Disappearing messages: what expires and when. Pure; `state/expiry.ts` applies it.
 *
 * Every device holding an entry runs the same clock from the same seen receipt and erases its own
 * copy, the sender's included. Nothing is synced as a delete.
 */

/** Models whose entries disappear, and which get seen receipts. */
export const EPHEMERAL_MODELS = ['directMessage', 'pix'] as const;

/** A seen entry is erased this long after it was seen. */
export const EXPIRE_AFTER_MS = 15 * 60 * 1000;

/** Nothing ephemeral outlives this: unseen entries, receipts whose entry never arrived, erased markers. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Local-only model recording erased entries, so a replayed write for one is not stored again. */
export const ERASED_MODEL = '_erased';

export function erasedKey(model: string, id: string): string {
  return `${model}:${id}`;
}

/** When an entry expires: `EXPIRE_AFTER_MS` after it was seen, and at most `MAX_AGE_MS` after it was sent. */
export function expiresAt(sentAt: number, viewedAt: number | null): number {
  const ceiling = sentAt + MAX_AGE_MS;
  return viewedAt === null ? ceiling : Math.min(ceiling, viewedAt + EXPIRE_AFTER_MS);
}
