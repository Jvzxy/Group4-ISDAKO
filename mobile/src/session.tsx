// Who is using this phone: nobody yet, a fisher (QR saved), or staff (signed in with the PIN).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, configureApi } from './api';
import { loadSaved, saveFisher, saveServer, saveStaff } from './storage';

// Expo inlines EXPO_PUBLIC_* variables at build time (set it in mobile/.env).
const ENV_SERVER = process.env.EXPO_PUBLIC_API_URL ?? '';

interface Session {
  /** false until the saved settings have been read */
  ready: boolean;
  serverUrl: string;
  fisherToken: string | null;
  staffSignedIn: boolean;
  setServerUrl: (url: string) => Promise<void>;
  /** Remember this QR on the phone, so the app opens straight to the fisher's deliveries. */
  claimFisher: (token: string) => Promise<void>;
  signOutFisher: () => Promise<void>;
  signInStaff: (pin: string) => Promise<void>;
  signOutStaff: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrlState] = useState('');
  const [fisherToken, setFisherToken] = useState<string | null>(null);
  const [staffSignedIn, setStaffSignedIn] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentServer = useRef('');

  const endStaff = useCallback(async () => {
    configureApi({ staffToken: null });
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = null;
    setStaffSignedIn(false);
    await saveStaff(null);
  }, []);

  const beginStaff = useCallback(
    (token: string, expiresAt: number) => {
      configureApi({ staffToken: token });
      setStaffSignedIn(true);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      // setTimeout cannot take more than about 24 days; a sign-in lasts 12 hours, but stay safe
      const wait = Math.min(Math.max(expiresAt - Date.now(), 0), 2147483647);
      expiryTimer.current = setTimeout(() => {
        void endStaff();
      }, wait);
    },
    [endStaff],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadSaved();
      if (cancelled) return;
      const url = saved.server ?? ENV_SERVER;
      currentServer.current = url;
      configureApi({
        baseUrl: url,
        onStaffExpired: () => {
          void endStaff();
        },
      });
      setServerUrlState(url);
      setFisherToken(saved.fisher);
      if (saved.staff) beginStaff(saved.staff.token, saved.staff.expiresAt);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [beginStaff, endStaff]);

  const setServerUrl = useCallback(
    async (url: string) => {
      // a staff sign-in belongs to one server, so changing the address signs staff out
      if (url !== currentServer.current) await endStaff();
      currentServer.current = url;
      configureApi({ baseUrl: url });
      setServerUrlState(url);
      await saveServer(url);
    },
    [endStaff],
  );

  const claimFisher = useCallback(async (token: string) => {
    setFisherToken(token);
    await saveFisher(token);
  }, []);

  const signOutFisher = useCallback(async () => {
    setFisherToken(null);
    await saveFisher(null);
  }, []);

  const signInStaff = useCallback(
    async (pin: string) => {
      const result = await api.login(pin);
      beginStaff(result.token, result.expiresAt);
      await saveStaff({ token: result.token, expiresAt: result.expiresAt });
    },
    [beginStaff],
  );

  const value = useMemo<Session>(
    () => ({
      ready,
      serverUrl,
      fisherToken,
      staffSignedIn,
      setServerUrl,
      claimFisher,
      signOutFisher,
      signInStaff,
      signOutStaff: endStaff,
    }),
    [ready, serverUrl, fisherToken, staffSignedIn, setServerUrl, claimFisher, signOutFisher, signInStaff, endStaff],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
