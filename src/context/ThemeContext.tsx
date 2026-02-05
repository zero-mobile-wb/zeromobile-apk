import React, { createContext, useContext, useState, ReactNode } from 'react';
import { themes, ThemeId } from '../constants/colors';

type Theme = typeof themes[ThemeId];

interface ThemeContextType {
  currentTheme: Theme;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  availableThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeId, setThemeId] = useState<ThemeId>('white');

  const setTheme = (newThemeId: ThemeId) => {
    setThemeId(newThemeId);
  };

  const value: ThemeContextType = {
    currentTheme: themes[themeId],
    themeId,
    setTheme,
    availableThemes: themes,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
