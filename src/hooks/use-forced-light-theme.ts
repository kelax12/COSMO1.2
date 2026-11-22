import { useLayoutEffect } from 'react';
import { applyTheme, resolveInitialTheme } from '@/lib/theme';

/**
 * Pages d'information (guide, légal, à propos, blog, pages métier) : toujours en clair,
 * quel que soit le thème du compte. Le thème clair est posé sur `<html>` pendant la page,
 * puis le thème enregistré est rétabli en la quittant (rien n'est écrit en stockage).
 */
export function useForcedLightTheme(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    applyTheme(root, 'light');
    return () => applyTheme(root, resolveInitialTheme());
  }, []);
}
