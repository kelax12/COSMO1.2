import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'black';

export const useDarkMode = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'black') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isDark, setIsDark] = useState(theme !== 'light');

  useEffect(() => {
    const root = window.document.documentElement;
    setIsDark(theme !== 'light');

    // `test` retiré du nettoyage : purge un éventuel reliquat en localStorage/DOM
    root.classList.remove('dark', 'black', 'test', 'monochrome', 'glass');

    // `black` garde la classe `dark` (variants Tailwind dark: + styles .dark)
    // et ajoute `black` qui override uniquement les variables de couleur.
    if (theme === 'dark' || theme === 'black') {
      root.classList.add('dark');
    }
    if (theme === 'black') {
      root.classList.add('black');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  /** Cycles: light → dark → black → light */
  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'black' : 'light');
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
