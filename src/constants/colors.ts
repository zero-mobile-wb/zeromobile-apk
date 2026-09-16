// Theme color scheme
export const themes = {
  white: {
    id: 'white' as const,
    name: 'Clean White',
    primary: '#e9e9e9',
    secondary: '#000000',
    accent: '#5f969c',
    background: '#FFFFFF',
    text: '#000000',
    textLight: '#6C757D',
    card: '#FFFFFF',
    border: '#E0E0E0',
    gradientStart: '#70a7ac',
    gradientEnd: '#5f969c',
    btnText: '#FFFFFF',
  },
  dark: {
    id: 'dark' as const,
    name: 'Dark Midnight',
    primary: '#111111',
    secondary: '#FFFFFF',
    accent: '#5f969c',
    background: '#111111',
    text: '#FFFFFF',
    textLight: '#AAAAAA',
    card: '#1A1A1A',
    border: '#2A2A2A',
    gradientStart: '#70a7ac',
    gradientEnd: '#5f969c',
    btnText: '#FFFFFF',
  },
} as const;

export type ThemeId = keyof typeof themes;
export type Theme = (typeof themes)[ThemeId];

// Static colors (theme-independent)
const staticColors = {
  white: '#FFFFFF',
  black: '#000000',
  gray: '#6C757D',
  lightGray: '#F8F9FA',
  darkGray: '#343A40',
  transparent: 'transparent',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
} as const;

// Default theme (White)
const colors = {
  primary: themes.white.primary,
  secondary: themes.white.secondary,
  accent: themes.white.accent,
  background: themes.white.background,
  text: themes.white.text,
  textLight: themes.white.textLight,
  ...staticColors,
} as const;

export default colors;