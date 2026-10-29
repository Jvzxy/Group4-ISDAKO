// Staff login: a shared PIN, a signed bearer token, and a simple brute-force limiter.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { dataDir } from './db';
import type { LoginResult } from './types';

const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours

export const TRUST_PROXY = Boolean(process.env.TRUST_PROXY);

const DEFAULT_PIN = '1234';
const STAFF_PIN = process.env.STAFF_PIN || DEFAULT_PIN;
export const usingDefaultPin = !process.env.STAFF_PIN;

function loadSecret(): Buffer {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET, 'utf8');
  const file = path.join(dataDir, 'session.secret');
  try {
    const existing = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
    if (existing.length >= 16) return existing;
  } catch {
    // no secret yet - create one below
  }
  const secret = crypto.randomBytes(32);
  fs.writeFileSync(file, secret.toString('hex'), { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

const hmac = (data: string): string => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Issues a signed token the app sends as `Authorization: Bearer <token>`. */
export function issueStaffToken(): LoginResult {
  const expiresAt = Date.now() + SESSION_MS;
  const body = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  return { token: `${body}.${hmac(body)}`, expiresAt };
}

export function isStaff(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (!header) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match || !match[1]) return false;
  const value = match[1];
  const dot = value.indexOf('.');
  if (dot < 0) return false;
  const body = value.slice(0, dot);
  if (!safeEqual(value.slice(dot + 1), hmac(body))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

const sha256 = (s: string): Buffer => crypto.createHash('sha256').update(s).digest();

export function pinMatches(pin: string): boolean {
  return crypto.timingSafeEqual(sha256(pin), sha256(STAFF_PIN));
}

// --- login attempt limiter: 5 wrong PINs per IP, then a 10 minute pause -------

const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

export function loginAllowed(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return true;
  if (entry.resetAt <= Date.now()) {
    failures.delete(ip);
    return true;
  }
  return entry.count < MAX_FAILURES;
}

export function recordFailure(ip: string): void {
  const now = Date.now();
  if (failures.size > 1000) {
    for (const [key, value] of failures) if (value.resetAt <= now) failures.delete(key);
  }
  const entry = failures.get(ip);
  if (entry && entry.resetAt > now) entry.count += 1;
  else failures.set(ip, { count: 1, resetAt: now + LOCK_MS });
}

export function clearFailures(ip: string): void {
  failures.delete(ip);
}
