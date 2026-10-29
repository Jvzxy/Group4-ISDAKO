// Talks to the ISDAKO server. Uses only fetch, so it has no phone-specific code.

import type {
  DayView,
  DeliveryResult,
  FisherAdmin,
  FisherPublic,
  FisherView,
  LoginResult,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const state: { baseUrl: string; staffToken: string | null; onStaffExpired: (() => void) | null } = {
  baseUrl: '',
  staffToken: null,
  onStaffExpired: null,
};

export function configureApi(next: {
  baseUrl?: string;
  staffToken?: string | null;
  onStaffExpired?: (() => void) | null;
}): void {
  if (next.baseUrl !== undefined) state.baseUrl = next.baseUrl;
  if (next.staffToken !== undefined) state.staffToken = next.staffToken;
  if (next.onStaffExpired !== undefined) state.onStaffExpired = next.onStaffExpired;
}

/** "192.168.1.10:3000" -> "http://192.168.1.10:3000". Returns null when it does not look like an address. */
export function normalizeServerUrl(input: string): string | null {
  let s = input.trim().replace(/\/+$/, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  return /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/i.test(s) ? s : null;
}

export function errorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
}

const TIMEOUT_MS = 15000;

async function request<T>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; staff?: boolean } = {},
): Promise<T> {
  if (!state.baseUrl) throw new ApiError(0, 'Set the server address first.');
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['Content-Type'] = 'application/json';
  if (opts.staff && state.staffToken) headers.Authorization = `Bearer ${state.staffToken}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(state.baseUrl + path, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(opts.body ?? {}),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your internet connection and the server address.");
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // the response had no JSON body
  }

  if (!res.ok) {
    const raw = data !== null && typeof data === 'object' ? (data as { error?: unknown }).error : undefined;
    const message = typeof raw === 'string' ? raw : 'Something went wrong. Please try again.';
    if (res.status === 401 && opts.staff) {
      if (state.onStaffExpired) state.onStaffExpired();
      throw new ApiError(401, 'Your staff sign-in has expired. Please sign in again.');
    }
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export interface FisherInput {
  name: string;
  boat: string | null;
  barangay: string | null;
  phone: string | null;
  smsOptIn: boolean;
}

export interface DeliveryInput {
  /** the fisher's QR token */
  token: string;
  species: string;
  kg: number | null;
  pieces: number | null;
  pricePerKg: number | null;
  note: string | null;
}

export const api = {
  health: () => request<{ name: string; ok: boolean; sms: string }>('/api/health'),

  // fisher (anyone holding the QR)
  fisherView: (token: string) => request<FisherView>(`/api/f/${encodeURIComponent(token)}`),
  setSms: (token: string, enabled: boolean) =>
    request<{ fisher: FisherPublic }>(`/api/f/${encodeURIComponent(token)}/sms`, {
      method: 'POST',
      body: { enabled },
    }),

  // staff
  login: (pin: string) => request<LoginResult>('/api/staff/login', { method: 'POST', body: { pin } }),
  fishers: () => request<{ fishers: FisherAdmin[] }>('/api/fishers', { staff: true }),
  createFisher: (input: FisherInput) =>
    request<{ fisher: FisherAdmin }>('/api/fishers', { method: 'POST', body: input, staff: true }),
  setPhone: (id: number, phone: string | null, smsOptIn: boolean) =>
    request<{ fisher: FisherAdmin }>(`/api/fishers/${id}/phone`, {
      method: 'POST',
      body: { phone, smsOptIn },
      staff: true,
    }),
  newQr: (id: number) =>
    request<{ fisher: FisherAdmin }>(`/api/fishers/${id}/new-qr`, { method: 'POST', staff: true }),
  addDelivery: (input: DeliveryInput) =>
    request<DeliveryResult>('/api/deliveries', { method: 'POST', body: input, staff: true }),
  voidDelivery: (id: number, reason: string) =>
    request<DeliveryResult>(`/api/deliveries/${id}/void`, { method: 'POST', body: { reason }, staff: true }),
  day: (date: string) => request<DayView>(`/api/deliveries?date=${encodeURIComponent(date)}`, { staff: true }),
};
