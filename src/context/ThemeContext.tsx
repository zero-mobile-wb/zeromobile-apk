import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, ThemeId, Theme } from '../constants/colors';

const THEME_KEY = 'zero_theme';

interface ThemeContextType {
  currentTheme: Theme;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  toggleTheme: () => void;
  availableThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeId, setThemeId] = useState<ThemeId>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'white' || stored === 'dark') {
        setThemeId(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setTheme = (newThemeId: ThemeId) => {
    setThemeId(newThemeId);
    AsyncStorage.setItem(THEME_KEY, newThemeId);
  };

  const toggleTheme = () => {
    const next = themeId === 'dark' ? 'white' : 'dark';
    setTheme(next);
  };

  const value: ThemeContextType = {
    currentTheme: themes[themeId],
    themeId,
    setTheme,
    toggleTheme,
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
