import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'monochrome' | 'glass';

export const useDarkMode = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Reset monochrome/glass to dark for release
    if (saved === 'monochrome' || saved === 'glass') {
      return 'dark';
    }
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

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      return 'light';
    });
  };

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
