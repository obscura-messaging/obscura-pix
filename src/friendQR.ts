/**
 * Friend-QR payload format. The QR encodes the friend code behind an Obscura
 * prefix so the scanner can ignore any non-Obscura QR it happens to see and
 * only react to ours. Shared by the QR generator (AddFriendScreen) and the
 * scanner (camera scan mode).
 */
const PREFIX = 'obscura:friend:';

/** Wrap a friend code into the QR payload string. */
export function encodeFriendQR(code: string): string {
  return `${PREFIX}${code}`;
}

/** Extract the friend code from a scanned QR value, or null if it isn't ours. */
export function parseFriendQR(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  const code = value.slice(PREFIX.length).trim();
  return code.length > 0 ? code : null;
}

// Provided by Hermes (and Node in tests); not in the TypeScript lib this project targets.
declare function atob(data: string): string;

/** Who a friend code points at, for display before the user decides to add them. */
export interface FriendCodeTarget {
  userId: string;
  username: string;
}

/**
 * Decode a friend code (`base64({"u": userId, "n": username})`, the kit's `FriendCode` format), or
 * null if it isn't one. The name is only a preview of what the QR claims; once added, the friend
 * graph is the source of names.
 */
export function decodeFriendCode(code: string): FriendCodeTarget | null {
  try {
    const json = JSON.parse(atob(code.trim().replace(/-/g, '+').replace(/_/g, '/'))) as unknown;
    if (json === null || typeof json !== 'object') return null;
    const { u, n } = json as { u?: unknown; n?: unknown };
    if (typeof u !== 'string' || u === '' || typeof n !== 'string' || n === '') return null;
    return { userId: u, username: n };
  } catch {
    return null;
  }
}
