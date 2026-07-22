import { useState, useEffect } from 'react';
import {
  applyTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme';

export type { Theme };

/** Ordre de cyclage du bouton unique : clair → sombre → noir → clair. */
const CYCLE: Theme[] = ['light', 'dark', 'black'];

export const useDarkMode = () => {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  const [isDark, setIsDark] = useState(theme !== 'light');

  useEffect(() => {
    setIsDark(theme !== 'light');
    applyTheme(window.document.documentElement, theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  const toggleTheme = () => {
    setThemeState((prev) => CYCLE[(CYCLE.indexOf(prev) + 1) % CYCLE.length]);
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
