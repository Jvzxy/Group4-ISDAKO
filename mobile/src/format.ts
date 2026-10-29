// Number, money, date and text formatting. Written by hand (no Intl) so it looks the same on every phone.

import { TZ_OFFSET_HOURS } from './constants';
import type { SmsStatus, Totals } from './types';

const withCommas = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 1234.5 -> "1,234.5" (at most 2 decimals) */
export function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [whole = '0', decimals] = String(rounded).split('.');
  return withCommas(whole) + (decimals ? `.${decimals}` : '');
}

/** 2220 -> "₱2,220.00" */
export function fmtMoney(n: number): string {
  const [whole = '0', decimals = '00'] = n.toFixed(2).split('.');
  return `₱${withCommas(whole)}.${decimals}`;
}

const OFFSET_MS = TZ_OFFSET_HOURS * 3600 * 1000;

/** Local (Philippine) calendar date, YYYY-MM-DD, for an ISO timestamp. */
export function localYmd(iso: string): string {
  return new Date(Date.parse(iso) + OFFSET_MS).toISOString().slice(0, 10);
}

export function todayYmd(): string {
  return localYmd(new Date().toISOString());
}

/** Moves a YYYY-MM-DD date by a number of days. */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function fmtTime(iso: string): string {
  const d = new Date(Date.parse(iso) + OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-10-26" -> "Monday, October 26" */
export function dayHeading(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]}, ${MONTHS[m - 1]} ${d}`;
}

/** "12.5 kg, 30 pcs" for a single delivery. */
export function qtyText(d: { kg: number | null; pieces: number | null }): string {
  const parts: string[] = [];
  if (d.kg !== null) parts.push(`${fmtNum(d.kg)} kg`);
  if (d.pieces !== null) parts.push(`${fmtNum(d.pieces)} pcs`);
  return parts.join(', ');
}

/** Same idea for a set of deliveries; shows "0 kg" when empty. */
export function totalsText(t: Pick<Totals, 'kg' | 'pieces'>): string {
  const parts: string[] = [];
  if (t.kg > 0) parts.push(`${fmtNum(t.kg)} kg`);
  if (t.pieces > 0) parts.push(`${fmtNum(t.pieces)} pcs`);
  return parts.length > 0 ? parts.join(', ') : '0 kg';
}

/** '' -> null, '12,5' -> 12.5, 'abc' -> NaN (so the caller can tell "empty" from "not a number") */
export function parseNumber(value: string): number | null {
  const s = value.trim().replace(',', '.');
  if (s === '') return null;
  return Number(s);
}

export function describeFisher(f: { boat: string | null; barangay: string | null }): string {
  return [f.boat, f.barangay].filter(Boolean).join(', ');
}

/** "+639171234567" -> "0917 123 4567" */
export function formatPhone(e164: string): string {
  const n = `0${e164.slice(3)}`;
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

/** What to tell staff after a delivery is saved or voided, based on what happened with the SMS. */
export function smsNotice(sms: SmsStatus, done: 'Saved' | 'Voided'): { message: string; kind: 'ok' | 'error' } {
  switch (sms) {
    case 'sent':
      return { message: `${done}. SMS sent to the fisher.`, kind: 'ok' };
    case 'failed':
      return { message: `${done}, but the SMS could not be sent.`, kind: 'error' };
    case 'test':
      return { message: `${done}. SMS test mode: nothing was actually sent.`, kind: 'ok' };
    case 'skipped':
      return { message: `${done}.`, kind: 'ok' };
  }
}
