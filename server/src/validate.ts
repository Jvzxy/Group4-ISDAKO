// Small input validators. Messages are shown to staff, so they are written for people.

import { HttpError } from './http';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface TextOptions {
  label: string;
  max: number;
  min?: number;
  required?: boolean;
}

/** Trimmed single-line text, or null when empty and not required. */
export function text(value: unknown, o: TextOptions): string | null {
  if (value === undefined || value === null) {
    if (o.required) throw new HttpError(400, `${cap(o.label)} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${cap(o.label)} is not valid.`);
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) {
    if (o.required) throw new HttpError(400, `${cap(o.label)} is required.`);
    return null;
  }
  const min = o.min ?? 1;
  if (s.length < min) throw new HttpError(400, `${cap(o.label)} must be at least ${min} characters.`);
  if (s.length > o.max) throw new HttpError(400, `${cap(o.label)} is too long (max ${o.max} characters).`);
  return s;
}

interface NumberOptions {
  label: string;
  max: number;
  integer?: boolean;
}

/** Positive number (decimals rounded to 2 places), or null when left empty. */
export function positive(value: unknown, o: NumberOptions): number | null {
  if (value === undefined || value === null) return null;
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    if (value.trim() === '') return null;
    n = Number(value.trim().replace(',', '.'));
  } else {
    n = Number.NaN;
  }
  if (!Number.isFinite(n) || n <= 0) {
    throw new HttpError(400, `${cap(o.label)} must be a number greater than 0.`);
  }
  if (n > o.max) throw new HttpError(400, `${cap(o.label)} is too large (max ${o.max}).`);
  if (o.integer) {
    if (!Number.isInteger(n)) throw new HttpError(400, `${cap(o.label)} must be a whole number.`);
    return n;
  }
  return Math.round(n * 100) / 100;
}
