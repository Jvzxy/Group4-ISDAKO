// What the phone remembers between launches: the server address, the fisher's QR code, and a staff sign-in.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  server: 'isdako.server',
  fisher: 'isdako.fisher',
  staff: 'isdako.staff',
} as const;

export interface StaffSession {
  token: string;
  /** epoch milliseconds */
  expiresAt: number;
}

export interface Saved {
  server: string | null;
  fisher: string | null;
  staff: StaffSession | null;
}

async function read(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // storage can fail on a full phone; the app keeps working for this session
  }
}

export async function loadSaved(): Promise<Saved> {
  const [server, fisher, staffRaw] = await Promise.all([read(KEYS.server), read(KEYS.fisher), read(KEYS.staff)]);
  let staff: StaffSession | null = null;
  if (staffRaw) {
    try {
      const parsed = JSON.parse(staffRaw) as Partial<StaffSession>;
      if (typeof parsed.token === 'string' && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
        staff = { token: parsed.token, expiresAt: parsed.expiresAt };
      }
    } catch {
      // ignore a damaged value
    }
  }
  return { server, fisher, staff };
}

export const saveServer = (url: string): Promise<void> => write(KEYS.server, url);
export const saveFisher = (token: string | null): Promise<void> => write(KEYS.fisher, token);
export const saveStaff = (session: StaffSession | null): Promise<void> =>
  write(KEYS.staff, session ? JSON.stringify(session) : null);
