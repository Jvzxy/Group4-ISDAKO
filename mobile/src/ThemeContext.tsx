
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useColorScheme } from 'react-native';
import type { ReactNode } from 'react';

import { lightColors, darkColors } from './theme';
import type { ThemeColors, ThemeMode } from './theme';

import { loadThemeMode, saveThemeMode } from './storage';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  ready: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();

  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      const savedMode = await loadThemeMode();

      if (mounted) {
        setModeState(savedMode);
        setReady(true);
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await saveThemeMode(nextMode);
  }, []);

  const colors = useMemo<ThemeColors>(() => {
    const useDark =
      mode === 'dark' ||
      (mode === 'system' && systemColorScheme === 'dark');

    return useDark ? darkColors : lightColors;
  }, [mode, systemColorScheme]);

  const value = useMemo(
    () => ({
      mode,
      colors,
      ready,
      setMode,
    }),
    [mode, colors, ready, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
