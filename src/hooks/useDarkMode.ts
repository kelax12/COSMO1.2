import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export const useDarkMode = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isDark, setIsDark] = useState(theme === 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    setIsDark(theme === 'dark');

    // `test` retiré du nettoyage : purge un éventuel reliquat en localStorage/DOM
    root.classList.remove('dark', 'test', 'monochrome', 'glass');

    if (theme === 'dark') {
      root.classList.add('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  /** Cycles: light → dark → light */
  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
