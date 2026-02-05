// Theme color scheme
export const themes = {
  white: {
    id: 'white',
    name: 'Clean White',
    primary: '#e9e9e9',
    secondary: '#000000',
    accent: '#e0e0e0ff',
    background: '#fef7f7ff',
    text: '#000000',
    textLight: '#6C757D',
  }
} as const;

export type ThemeId = keyof typeof themes;

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