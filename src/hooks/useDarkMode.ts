import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'test';

export const useDarkMode = (allowTest = false) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (saved === 'test') return allowTest ? 'test' : 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isDark, setIsDark] = useState(theme === 'dark' || theme === 'test');

  useEffect(() => {
    const effective: Theme = (theme === 'test' && !allowTest) ? 'dark' : theme;
    const root = window.document.documentElement;
    setIsDark(effective === 'dark' || effective === 'test');

    root.classList.remove('dark', 'test', 'monochrome', 'glass');

    if (effective === 'dark') {
      root.classList.add('dark');
    } else if (effective === 'test') {
      // `dark` → palette + utilitaires Tailwind dark: ; `test` → hook d'aiguillage UI
      root.classList.add('dark', 'test');
    }

    localStorage.setItem('theme', effective);
  }, [theme, allowTest]);

  const setTheme = (t: Theme) => {
    if (t === 'test' && !allowTest) return;
    setThemeState(t);
  };

  /** Cycles: light → dark → light (le mode `test` se choisit explicitement) */
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
