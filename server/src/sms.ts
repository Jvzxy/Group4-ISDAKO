// SMS alerts: phone number handling, message wording, and the gateways (Semaphore, Twilio, or test mode).
// Sending never throws. If the gateway fails, the delivery is still saved and the caller gets 'failed'.

import { TZ_OFFSET_HOURS } from './constants';
import type { Delivery, SmsStatus, Totals } from './types';

// ---------------------------------------------------------------------------
// Phone numbers (Philippine mobile numbers)
// ---------------------------------------------------------------------------

export interface Phone {
  /** +639XXXXXXXXX, how it is stored and what Twilio needs */
  e164: string;
  /** 09XXXXXXXXX, what Semaphore accepts */
  national: string;
}

/** Accepts 0917 123 4567, +63 917 123 4567, 63917..., 917... Returns null when it is not a PH mobile number. */
export function normalizePhone(input: string): Phone | null {
  const digits = input.replace(/[\s\-().]/g, '');
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(digits);
  if (!m || !m[1]) return null;
  return { e164: `+63${m[1]}`, national: `0${m[1]}` };
}

/** "+639171234567" -> "0917 *** 4567" */
export function maskPhone(e164: string): string {
  const national = `0${e164.slice(3)}`;
  return `${national.slice(0, 4)} *** ${national.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Wording. Plain ASCII only, so a message stays one 160-character SMS segment where possible.
// ---------------------------------------------------------------------------

const ascii = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const num = (n: number): string => String(Math.round(n * 100) / 100);
const money = (n: number): string => `PHP ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

function qty(d: { kg: number | null; pieces: number | null }): string {
  const parts: string[] = [];
  if (d.kg !== null) parts.push(`${num(d.kg)} kg`);
  if (d.pieces !== null) parts.push(`${num(d.pieces)} pcs`);
  return parts.join(' / ');
}

function totalsLabel(t: Pick<Totals, 'kg' | 'pieces'>): string {
  const parts: string[] = [];
  if (t.kg > 0) parts.push(`${num(t.kg)} kg`);
  if (t.pieces > 0) parts.push(`${num(t.pieces)} pcs`);
  return parts.length > 0 ? parts.join(', ') : '0 kg';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(iso: string): string {
  const d = new Date(Date.parse(iso) + TZ_OFFSET_HOURS * 3600 * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function firstName(fullName: string): string {
  return ascii(fullName).split(' ')[0] || 'there';
}

export function deliveryMessage(fisherName: string, d: Delivery, today: Pick<Totals, 'kg' | 'pieces'>): string {
  const amount = d.amount !== null ? ` (${money(d.amount)})` : '';
  return `ISDAKO: Hi ${firstName(fisherName)}, we recorded ${qty(d)} ${ascii(d.species)}${amount}. Today's total: ${totalsLabel(today)}.`;
}

export function voidMessage(fisherName: string, d: Delivery): string {
  return `ISDAKO: Hi ${firstName(fisherName)}, correction: your ${qty(d)} ${ascii(d.species)} delivery on ${dateLabel(d.deliveredAt)} was cancelled.`;
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

type Provider = 'off' | 'console' | 'semaphore' | 'twilio';

const PROVIDERS: readonly Provider[] = ['off', 'console', 'semaphore', 'twilio'];
const requested = (process.env.SMS_PROVIDER ?? 'console').trim().toLowerCase();
export const smsProvider: Provider = (PROVIDERS as readonly string[]).includes(requested)
  ? (requested as Provider)
  : 'console';

/** Problems that stop the server from starting, so a typo never silently means "no SMS". */
export function smsConfigProblems(): string[] {
  const problems: string[] = [];
  if (!(PROVIDERS as readonly string[]).includes(requested)) {
    problems.push(`SMS_PROVIDER "${requested}" is not valid. Use off, console, semaphore or twilio.`);
  }
  if (smsProvider === 'semaphore' && !process.env.SEMAPHORE_API_KEY) {
    problems.push('SMS_PROVIDER=semaphore needs SEMAPHORE_API_KEY.');
  }
  if (smsProvider === 'twilio') {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      problems.push('SMS_PROVIDER=twilio needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    if (!process.env.TWILIO_FROM && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
      problems.push('SMS_PROVIDER=twilio needs TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID.');
    }
  }
  return problems;
}

const TIMEOUT_MS = 8000;

function logFailure(provider: string, phone: Phone, detail: string): void {
  console.error(`SMS failed (${provider}, to ${maskPhone(phone.e164)}): ${detail.slice(0, 300)}`);
}

async function viaSemaphore(phone: Phone, message: string): Promise<SmsStatus> {
  const url = process.env.SEMAPHORE_URL ?? 'https://api.semaphore.co/api/v4/messages';
  const body = new URLSearchParams({
    apikey: process.env.SEMAPHORE_API_KEY ?? '',
    number: phone.national,
    message,
  });
  if (process.env.SEMAPHORE_SENDER) body.set('sendername', process.env.SEMAPHORE_SENDER);

  const res = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // not JSON
  }
  // Success is a JSON array with one entry per recipient; status is Queued/Pending/Sent (or Failed).
  if (res.ok && Array.isArray(json) && json.length > 0) {
    const first = json[0] as { status?: unknown };
    if (first.status !== 'Failed' && first.status !== 'Refunded') return 'sent';
  }
  logFailure('semaphore', phone, `HTTP ${res.status} ${raw}`);
  return 'failed';
}

async function viaTwilio(phone: Phone, message: string): Promise<SmsStatus> {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const url = process.env.TWILIO_URL ?? `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({ To: phone.e164, Body: message });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) body.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  else body.set('From', process.env.TWILIO_FROM ?? '');

  const res = await fetch(url, {
    method: 'POST',
    body,
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 201 || res.status === 200) return 'sent';
  logFailure('twilio', phone, `HTTP ${res.status} ${await res.text()}`);
  return 'failed';
}

export async function sendSms(phone: Phone, message: string): Promise<SmsStatus> {
  try {
    switch (smsProvider) {
      case 'off':
        return 'skipped';
      case 'console':
        console.log(`[SMS test mode] to ${phone.national}: ${message}`);
        return 'test';
      case 'semaphore':
        return await viaSemaphore(phone, message);
      case 'twilio':
        return await viaTwilio(phone, message);
    }
  } catch (err) {
    logFailure(smsProvider, phone, err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}
