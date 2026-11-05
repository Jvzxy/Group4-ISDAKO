
// Light theme
export const lightColors = {
  abyss: '#0e3a52',
  ice: '#eef5f7',
  foam: '#ffffff',
  line: '#cfdfe5',
  muted: '#53697a',
  yellow: '#f6b93b',
  yellowInk: '#3b2a00',
  coral: '#b8391d',
  onDarkMuted: '#bcd2dc',

  background: '#eef5f7',
  surface: '#ffffff',
  text: '#0e3a52',
  border: '#cfdfe5',
  secondaryText: '#53697a',
} as const;

// Dark theme
export const darkColors = {
  abyss: '#071d2b',
  ice: '#102d3d',
  foam: '#183b4d',
  line: '#315466',
  muted: '#a5bac6',
  yellow: '#f6b93b',
  yellowInk: '#3b2a00',
  coral: '#ff806b',
  onDarkMuted: '#bcd2dc',

  background: '#071d2b',
  surface: '#183b4d',
  text: '#eef5f7',
  border: '#315466',
  secondaryText: '#a5bac6',
} as const;

// Keep existing components working while we migrate them.
export const colors = lightColors;
export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export type ThemeMode = 'light' | 'dark' | 'system';

export const TAB_BAR_HEIGHT = 64;
