import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export const useDarkMode = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isDark, setIsDark] = useState(theme === 'dark');

  useEffect(() => {
    const root = window.document.documentElement;
    setIsDark(theme === 'dark');

    root.classList.remove('dark', 'monochrome', 'glass');

    if (theme === 'dark') {
      root.classList.add('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  /** Cycles: light → dark → light */
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
