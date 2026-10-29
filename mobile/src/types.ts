// API types. The mobile app keeps an identical copy in mobile/src/types.ts - keep them in sync.

export interface Totals {
  deliveries: number;
  kg: number;
  pieces: number;
  amount: number;
}

export interface Summary {
  today: Totals;
  week: Totals;
  month: Totals;
  all: Totals;
}

export interface Delivery {
  id: number;
  fisherId: number;
  species: string;
  kg: number | null;
  pieces: number | null;
  pricePerKg: number | null;
  /** kg x pricePerKg, only when both are known */
  amount: number | null;
  note: string | null;
  /** ISO timestamp (UTC) */
  deliveredAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

/** What a fisher (or anyone holding their QR) is allowed to see. */
export interface FisherPublic {
  id: number;
  name: string;
  boat: string | null;
  barangay: string | null;
  /** e.g. "0917 *** 4567", never the full number */
  phoneHint: string | null;
  /** true only when SMS alerts are on and a phone number is on file */
  smsOptIn: boolean;
}

/** Staff-only view: includes the secret QR token and the full phone number. */
export interface FisherAdmin extends FisherPublic {
  token: string;
  /** +639XXXXXXXXX */
  phone: string | null;
  createdAt: string;
}

export interface FisherView {
  fisher: FisherPublic;
  summary: Summary;
  deliveries: Delivery[];
}

export interface DayDelivery extends Delivery {
  fisherName: string;
  fisherToken: string;
}

export interface DayView {
  /** local date, YYYY-MM-DD */
  date: string;
  totals: Totals;
  items: DayDelivery[];
}

/**
 * sent    = handed to the SMS gateway
 * failed  = the gateway rejected it or could not be reached (the delivery is still saved)
 * skipped = no phone number, or the fisher turned SMS off
 * test    = SMS_PROVIDER=console: printed in the server log only
 */
export type SmsStatus = 'sent' | 'failed' | 'skipped' | 'test';

export interface DeliveryResult {
  delivery: Delivery;
  sms: SmsStatus;
}

export interface LoginResult {
  token: string;
  /** epoch milliseconds */
  expiresAt: number;
}
