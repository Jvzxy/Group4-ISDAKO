// What goes inside a fisher's QR code, and how to read it back.

import { TOKEN_RE } from './constants';

const PREFIX = 'isdako:';

/** The text stored in the QR code. */
export function qrValue(token: string): string {
  return `${PREFIX}${token}`;
}

/**
 * Reads a scanned QR (or a typed code) and returns the fisher's token, or null if it is not ours.
 * Accepts "isdako:<token>", a link ending in "/f/<token>", or the bare token.
 */
export function tokenFromQr(data: string): string | null {
  const s = data.trim();
  if (s.toLowerCase().startsWith(PREFIX)) {
    const token = s.slice(PREFIX.length).trim();
    return TOKEN_RE.test(token) ? token : null;
  }
  const link = /\/f\/([A-Za-z0-9_-]{16,64})(?:[/?#]|$)/.exec(s);
  if (link && link[1]) return link[1];
  return TOKEN_RE.test(s) ? s : null;
}
