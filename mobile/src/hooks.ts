import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, api, errorText } from './api';
import type { FisherView } from './types';

const REFRESH_MS = 45000;

/**
 * Loads a fisher's deliveries and keeps them fresh: every 45 seconds while the app is open,
 * and again whenever the app comes back to the front.
 */
export function useFisherView(token: string) {
  const [view, setView] = useState<FisherView | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const alive = useRef(true);
  const tokenRef = useRef(token);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const load = useCallback(
    async (manual = false) => {
      const requested = token;
      if (manual) setRefreshing(true);
      try {
        const next = await api.fisherView(requested);
        if (!alive.current || tokenRef.current !== requested) return;
        setView(next);
        setError(null);
        setUpdatedAt(new Date().toISOString());
      } catch (err) {
        if (!alive.current || tokenRef.current !== requested) return;
        setError({ message: errorText(err), notFound: err instanceof ApiError && err.status === 404 });
      } finally {
        if (alive.current && manual) setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [load]);

  return {
    view,
    error,
    refreshing,
    updatedAt,
    refresh: () => load(true),
    reload: () => load(),
  };
}
