// All API endpoints.

import { TOKEN_RE } from './constants';
import { clearFailures, isStaff, issueStaffToken, loginAllowed, pinMatches, recordFailure } from './auth';
import * as store from './db';
import { HttpError, Router, readJson, sendJson } from './http';
import { deliveryMessage, maskPhone, normalizePhone, sendSms, smsProvider, voidMessage } from './sms';
import type { Phone } from './sms';
import type { Delivery, DeliveryResult, FisherAdmin, FisherPublic, FisherView, SmsStatus } from './types';
import { positive, text } from './validate';

function toPublic(f: store.FisherRecord): FisherPublic {
  return {
    id: f.id,
    name: f.name,
    boat: f.boat,
    barangay: f.barangay,
    phoneHint: f.phone ? maskPhone(f.phone) : null,
    smsOptIn: f.smsOptIn,
  };
}

function toAdmin(f: store.FisherRecord): FisherAdmin {
  return { ...toPublic(f), token: f.token, phone: f.phone, createdAt: f.createdAt };
}

function parseId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Not found.');
  return id;
}

function requireFisherByToken(token: string): store.FisherRecord {
  const fisher = TOKEN_RE.test(token) ? store.getFisherByToken(token) : null;
  if (!fisher) throw new HttpError(404, 'This QR code was not recognized. Ask the staff for a new one.');
  return fisher;
}

/** Empty text means "no phone". Anything else must be a Philippine mobile number. */
function parsePhone(value: unknown): Phone | null {
  const raw = text(value, { label: 'phone number', max: 30 });
  if (raw === null) return null;
  const phone = normalizePhone(raw);
  if (!phone) throw new HttpError(400, 'Enter a Philippine mobile number, for example 0917 123 4567.');
  return phone;
}

/** Texts the fisher when they opted in and have a number. Never throws; the delivery is already saved. */
async function alert(fisher: store.FisherRecord, message: (f: store.FisherRecord) => string): Promise<SmsStatus> {
  if (!fisher.smsOptIn || !fisher.phone) return 'skipped';
  const phone = normalizePhone(fisher.phone);
  if (!phone) return 'skipped';
  return sendSms(phone, message(fisher));
}

export function buildRouter(): Router {
  const r = new Router();

  // ---- health (the app uses this to check the server address) -----------------
  r.add('GET', '/', ({ res }) => {
    sendJson(res, 200, { name: 'ISDAKO', ok: true });
  });
  r.add('GET', '/api/health', ({ res }) => {
    sendJson(res, 200, { name: 'ISDAKO', ok: true, sms: smsProvider });
  });

  // ---- staff session ---------------------------------------------------------
  r.add('GET', '/api/staff/me', ({ req, res }) => {
    sendJson(res, 200, { staff: isStaff(req) });
  });

  r.add('POST', '/api/staff/login', async ({ req, res, ip }) => {
    if (!loginAllowed(ip)) {
      throw new HttpError(429, 'Too many wrong PINs. Wait 10 minutes and try again.');
    }
    const body = await readJson(req);
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!pinMatches(pin)) {
      recordFailure(ip);
      throw new HttpError(401, 'Wrong PIN.');
    }
    clearFailures(ip);
    sendJson(res, 200, issueStaffToken());
  });

  // ---- fishers (staff) -------------------------------------------------------
  r.add(
    'GET',
    '/api/fishers',
    ({ res }) => {
      sendJson(res, 200, { fishers: store.listFishers().map(toAdmin) });
    },
    { staff: true },
  );

  r.add(
    'POST',
    '/api/fishers',
    async ({ req, res }) => {
      const body = await readJson(req);
      const name = text(body.name, { label: 'name', min: 2, max: 80, required: true }) as string;
      const boat = text(body.boat, { label: 'boat name', max: 60 });
      const barangay = text(body.barangay, { label: 'barangay', max: 60 });
      const phone = parsePhone(body.phone);
      const fisher = store.createFisher({
        name,
        boat,
        barangay,
        phone: phone ? phone.e164 : null,
        // SMS is on by default when a number is given, unless staff turned it off
        smsOptIn: phone !== null && body.smsOptIn !== false,
      });
      sendJson(res, 201, { fisher: toAdmin(fisher) });
    },
    { staff: true },
  );

  // Add, change or remove the phone number (an empty phone removes it and turns SMS off).
  r.add(
    'POST',
    '/api/fishers/:id/phone',
    async ({ req, res, params }) => {
      const body = await readJson(req);
      const phone = parsePhone(body.phone);
      const fisher = store.setPhone(parseId(params.id), phone ? phone.e164 : null, body.smsOptIn !== false);
      if (!fisher) throw new HttpError(404, 'Fisher not found.');
      sendJson(res, 200, { fisher: toAdmin(fisher) });
    },
    { staff: true },
  );

  // Lost or stolen QR: issue a new one. The old QR stops working immediately.
  r.add(
    'POST',
    '/api/fishers/:id/new-qr',
    ({ res, params }) => {
      const fisher = store.regenerateToken(parseId(params.id));
      if (!fisher) throw new HttpError(404, 'Fisher not found.');
      sendJson(res, 200, { fisher: toAdmin(fisher) });
    },
    { staff: true },
  );

  // ---- deliveries (staff) ----------------------------------------------------
  r.add(
    'POST',
    '/api/deliveries',
    async ({ req, res }) => {
      const body = await readJson(req);
      const token = text(body.token, { label: 'QR code', max: 64, required: true }) as string;
      const fisher = requireFisherByToken(token);

      const species = text(body.species, { label: 'type of fish', min: 2, max: 60, required: true }) as string;
      const kg = positive(body.kg, { label: 'kilos', max: 10000 });
      const pieces = positive(body.pieces, { label: 'number of fish', max: 100000, integer: true });
      const pricePerKg = positive(body.pricePerKg, { label: 'price per kilo', max: 100000 });
      const note = text(body.note, { label: 'note', max: 200 });

      if (kg === null && pieces === null) {
        throw new HttpError(400, 'Enter the kilos or the number of fish.');
      }
      if (pricePerKg !== null && kg === null) {
        throw new HttpError(400, 'A price per kilo needs the kilos too.');
      }

      const delivery: Delivery = store.addDelivery(fisher.id, { species, kg, pieces, pricePerKg, note });
      const sms = await alert(fisher, (f) => deliveryMessage(f.name, delivery, store.summaryFor(f.id).today));
      const result: DeliveryResult = { delivery, sms };
      sendJson(res, 201, result);
    },
    { staff: true },
  );

  r.add(
    'POST',
    '/api/deliveries/:id/void',
    async ({ req, res, params }) => {
      const body = await readJson(req);
      const reason = text(body.reason, { label: 'reason', max: 120 });
      const delivery = store.voidDelivery(parseId(params.id), reason);
      if (!delivery) throw new HttpError(404, 'Delivery not found, or it is already voided.');
      const fisher = store.getFisherById(delivery.fisherId);
      const sms = fisher ? await alert(fisher, (f) => voidMessage(f.name, delivery)) : 'skipped';
      const result: DeliveryResult = { delivery, sms };
      sendJson(res, 200, result);
    },
    { staff: true },
  );

  // All deliveries on one local date (default: today), for the staff "Today" tab.
  r.add(
    'GET',
    '/api/deliveries',
    ({ res, url }) => {
      const date = url.searchParams.get('date') ?? store.localToday();
      if (!store.isValidDate(date)) throw new HttpError(400, 'The date is not valid.');
      sendJson(res, 200, store.dayView(date));
    },
    { staff: true },
  );

  // ---- public: what the fisher sees after scanning their QR ----------------------
  r.add('GET', '/api/f/:token', ({ res, params }) => {
    const fisher = requireFisherByToken(params.token ?? '');
    const view: FisherView = {
      fisher: toPublic(fisher),
      summary: store.summaryFor(fisher.id),
      deliveries: store.deliveriesForFisher(fisher.id),
    };
    sendJson(res, 200, view);
  });

  // The fisher turns SMS alerts on or off for their own number.
  r.add('POST', '/api/f/:token/sms', async ({ req, res, params }) => {
    const fisher = requireFisherByToken(params.token ?? '');
    const body = await readJson(req);
    if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'Say whether SMS alerts should be on or off.');
    if (body.enabled && !fisher.phone) {
      throw new HttpError(400, 'No phone number is on file. Ask the staff to add yours.');
    }
    const updated = store.setSmsOptIn(fisher.id, body.enabled);
    if (!updated) throw new HttpError(404, 'Fisher not found.');
    sendJson(res, 200, { fisher: toPublic(updated) });
  });

  return r;
}
