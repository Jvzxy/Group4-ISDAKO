// SQLite storage using Node's built-in node:sqlite (no native add-ons to compile).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TZ_OFFSET_HOURS } from './constants';
import type { DayDelivery, DayView, Delivery, Summary, Totals } from './types';

export const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'isdako.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
  CREATE TABLE IF NOT EXISTS fishers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    boat       TEXT,
    barangay   TEXT,
    phone      TEXT,
    sms_opt_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fisher_id    INTEGER NOT NULL REFERENCES fishers(id),
    species      TEXT NOT NULL,
    kg           REAL,
    pieces       INTEGER,
    price_per_kg REAL,
    note         TEXT,
    delivered_at TEXT NOT NULL,
    voided_at    TEXT,
    void_reason  TEXT,
    CHECK (kg IS NOT NULL OR pieces IS NOT NULL)
  );

  CREATE INDEX IF NOT EXISTS idx_deliveries_fisher ON deliveries (fisher_id, delivered_at);
  CREATE INDEX IF NOT EXISTS idx_deliveries_time ON deliveries (delivered_at);
`);

// Databases created before SMS alerts existed get the new column.
const fisherColumns = db.prepare('PRAGMA table_info(fishers)').all() as unknown as Array<{ name: string }>;
if (!fisherColumns.some((c) => c.name === 'sms_opt_in')) {
  db.exec('ALTER TABLE fishers ADD COLUMN sms_opt_in INTEGER NOT NULL DEFAULT 0');
}

/** SQLite date modifier that shifts UTC timestamps to local (Philippine) time. */
const OFF = `${TZ_OFFSET_HOURS >= 0 ? '+' : '-'}${Math.abs(TZ_OFFSET_HOURS)} hours`;

// ---------------------------------------------------------------------------
// Row types (snake_case as stored) and mapping to the camelCase API types
// ---------------------------------------------------------------------------

interface FisherRow {
  id: number;
  token: string;
  name: string;
  boat: string | null;
  barangay: string | null;
  phone: string | null;
  sms_opt_in: number;
  created_at: string;
}

interface DeliveryRow {
  id: number;
  fisher_id: number;
  species: string;
  kg: number | null;
  pieces: number | null;
  price_per_kg: number | null;
  note: string | null;
  delivered_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

interface DayRow extends DeliveryRow {
  fisher_name: string;
  fisher_token: string;
}

/** A fisher including the secret token and full phone. Never sent to a fisher as is. */
export interface FisherRecord {
  id: number;
  token: string;
  name: string;
  boat: string | null;
  barangay: string | null;
  /** +639XXXXXXXXX */
  phone: string | null;
  smsOptIn: boolean;
  createdAt: string;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function toFisher(r: FisherRow): FisherRecord {
  return {
    id: r.id,
    token: r.token,
    name: r.name,
    boat: r.boat,
    barangay: r.barangay,
    phone: r.phone,
    smsOptIn: r.sms_opt_in === 1 && r.phone !== null,
    createdAt: r.created_at,
  };
}

function toDelivery(r: DeliveryRow): Delivery {
  const amount = r.kg !== null && r.price_per_kg !== null ? round2(r.kg * r.price_per_kg) : null;
  return {
    id: r.id,
    fisherId: r.fisher_id,
    species: r.species,
    kg: r.kg,
    pieces: r.pieces,
    pricePerKg: r.price_per_kg,
    amount,
    note: r.note,
    deliveredAt: r.delivered_at,
    voidedAt: r.voided_at,
    voidReason: r.void_reason,
  };
}

const nowIso = (): string => new Date().toISOString();
const newToken = (): string => crypto.randomBytes(16).toString('base64url');

// ---------------------------------------------------------------------------
// Fishers
// ---------------------------------------------------------------------------

export function listFishers(): FisherRecord[] {
  const rows = db.prepare('SELECT * FROM fishers ORDER BY name COLLATE NOCASE, id').all() as unknown as FisherRow[];
  return rows.map(toFisher);
}

export function getFisherById(id: number): FisherRecord | null {
  const row = db.prepare('SELECT * FROM fishers WHERE id = ?').get(id) as unknown as FisherRow | undefined;
  return row ? toFisher(row) : null;
}

export function getFisherByToken(token: string): FisherRecord | null {
  const row = db.prepare('SELECT * FROM fishers WHERE token = ?').get(token) as unknown as FisherRow | undefined;
  return row ? toFisher(row) : null;
}

export function createFisher(input: {
  name: string;
  boat: string | null;
  barangay: string | null;
  phone: string | null;
  smsOptIn: boolean;
}): FisherRecord {
  const result = db
    .prepare(
      'INSERT INTO fishers (token, name, boat, barangay, phone, sms_opt_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      newToken(),
      input.name,
      input.boat,
      input.barangay,
      input.phone,
      input.smsOptIn && input.phone !== null ? 1 : 0,
      nowIso(),
    );
  const created = getFisherById(Number(result.lastInsertRowid));
  if (!created) throw new Error('The fisher could not be saved.');
  return created;
}

/** Issues a new secret token. The old QR stops working immediately. */
export function regenerateToken(id: number): FisherRecord | null {
  const result = db.prepare('UPDATE fishers SET token = ? WHERE id = ?').run(newToken(), id);
  return result.changes > 0 ? getFisherById(id) : null;
}

/** Sets or clears the phone number. Clearing it also turns SMS off. */
export function setPhone(id: number, phone: string | null, smsOptIn: boolean): FisherRecord | null {
  const result = db
    .prepare('UPDATE fishers SET phone = ?, sms_opt_in = ? WHERE id = ?')
    .run(phone, phone !== null && smsOptIn ? 1 : 0, id);
  return result.changes > 0 ? getFisherById(id) : null;
}

export function setSmsOptIn(id: number, enabled: boolean): FisherRecord | null {
  const result = db.prepare('UPDATE fishers SET sms_opt_in = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  return result.changes > 0 ? getFisherById(id) : null;
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export function getDelivery(id: number): Delivery | null {
  const row = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id) as unknown as DeliveryRow | undefined;
  return row ? toDelivery(row) : null;
}

export function addDelivery(
  fisherId: number,
  d: {
    species: string;
    kg: number | null;
    pieces: number | null;
    pricePerKg: number | null;
    note: string | null;
  },
): Delivery {
  const result = db
    .prepare(
      `INSERT INTO deliveries (fisher_id, species, kg, pieces, price_per_kg, note, delivered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(fisherId, d.species, d.kg, d.pieces, d.pricePerKg, d.note, nowIso());
  const created = getDelivery(Number(result.lastInsertRowid));
  if (!created) throw new Error('The delivery could not be saved.');
  return created;
}

/** Marks a delivery as void (kept for the record, excluded from totals). */
export function voidDelivery(id: number, reason: string | null): Delivery | null {
  const result = db
    .prepare('UPDATE deliveries SET voided_at = ?, void_reason = ? WHERE id = ? AND voided_at IS NULL')
    .run(nowIso(), reason, id);
  return result.changes > 0 ? getDelivery(id) : null;
}

export function deliveriesForFisher(fisherId: number, limit = 300): Delivery[] {
  const rows = db
    .prepare('SELECT * FROM deliveries WHERE fisher_id = ? ORDER BY delivered_at DESC, id DESC LIMIT ?')
    .all(fisherId, limit) as unknown as DeliveryRow[];
  return rows.map(toDelivery);
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

const TOTALS_SQL = `
  SELECT COUNT(*)                                   AS deliveries,
         COALESCE(SUM(kg), 0)                       AS kg,
         COALESCE(SUM(pieces), 0)                   AS pieces,
         COALESCE(SUM(CASE WHEN kg IS NOT NULL AND price_per_kg IS NOT NULL
                           THEN kg * price_per_kg END), 0) AS amount
    FROM deliveries
   WHERE voided_at IS NULL`;

interface TotalsRow {
  deliveries: number;
  kg: number;
  pieces: number;
  amount: number;
}

function toTotals(r: TotalsRow): Totals {
  return {
    deliveries: r.deliveries,
    kg: round2(r.kg),
    pieces: r.pieces,
    amount: round2(r.amount),
  };
}

// Conditions are fixed strings (never user input). `@off` is bound as a parameter.
const RANGES = {
  today: "date(delivered_at, @off) = date('now', @off)",
  week: "date(delivered_at, @off) >= date('now', @off, '-6 days')",
  month: "strftime('%Y-%m', delivered_at, @off) = strftime('%Y-%m', 'now', @off)",
} as const;

/** Today, last 7 days, this month and all-time totals for one fisher (voided deliveries excluded). */
export function summaryFor(fisherId: number): Summary {
  const run = (cond: string | null): Totals => {
    const sql = `${TOTALS_SQL} AND fisher_id = @fid${cond ? ` AND ${cond}` : ''}`;
    // node:sqlite rejects named parameters that the SQL does not use, so only pass @off when needed
    const params: Record<string, string | number> = cond ? { fid: fisherId, off: OFF } : { fid: fisherId };
    return toTotals(db.prepare(sql).get(params) as unknown as TotalsRow);
  };
  return {
    today: run(RANGES.today),
    week: run(RANGES.week),
    month: run(RANGES.month),
    all: run(null),
  };
}

// ---------------------------------------------------------------------------
// Daily log (all fishers)
// ---------------------------------------------------------------------------

export function localToday(): string {
  const row = db.prepare("SELECT date('now', @off) AS d").get({ off: OFF }) as unknown as { d: string };
  return row.d;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function dayView(date: string): DayView {
  const rows = db
    .prepare(
      `SELECT d.*, f.name AS fisher_name, f.token AS fisher_token
         FROM deliveries d
         JOIN fishers f ON f.id = d.fisher_id
        WHERE date(d.delivered_at, @off) = @date
        ORDER BY d.delivered_at DESC, d.id DESC`,
    )
    .all({ off: OFF, date }) as unknown as DayRow[];

  const items: DayDelivery[] = rows.map((r) => ({
    ...toDelivery(r),
    fisherName: r.fisher_name,
    fisherToken: r.fisher_token,
  }));

  const totals = toTotals(
    db
      .prepare(`${TOTALS_SQL} AND date(delivered_at, @off) = @date`)
      .get({ off: OFF, date }) as unknown as TotalsRow,
  );

  return { date, totals, items };
}

export function closeDb(): void {
  db.close();
}
