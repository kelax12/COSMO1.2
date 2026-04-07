import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'monochrome' | 'glass';

const CYCLE: Theme[] = ['light', 'dark', 'monochrome'];

export const useDarkMode = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'monochrome') return saved;
    // glass falls back to dark
    if (saved === 'glass') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [isDark, setIsDark] = useState(theme === 'dark' || theme === 'monochrome' || theme === 'glass');

  useEffect(() => {
    const root = window.document.documentElement;
    const shouldBeDark = theme === 'dark' || theme === 'monochrome' || theme === 'glass';
    setIsDark(shouldBeDark);

    root.classList.remove('dark', 'monochrome', 'glass');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'monochrome') {
      root.classList.add('dark', 'monochrome');
    } else if (theme === 'glass') {
      root.classList.add('dark', 'glass');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  /** Cycles: light → dark → monochrome → light */
  const toggleTheme = () => {
    setTheme(prev => {
      const idx = CYCLE.indexOf(prev);
      return CYCLE[(idx + 1) % CYCLE.length];
    });
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
