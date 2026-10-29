/** The Philippines has no daylight saving, so a fixed +8 offset is safe. */
export const TZ_OFFSET_HOURS = 8;

/** QR tokens are 16 random bytes encoded as base64url (22 characters). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Quick picks for "Type of fish". Staff can still type any name. */
export const COMMON_SPECIES = [
  'Tulingan',
  'Tamban',
  'Galunggong',
  'Bangsi',
  'Lapu-lapu',
  'Maya-maya',
  'Pusit',
  'Alumahan',
  'Hasa-hasa',
  'Tanigue',
  'Bisugo',
  'Danggit',
];
