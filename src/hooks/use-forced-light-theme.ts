import { useLayoutEffect } from 'react';
import { applyTheme } from '@/lib/theme';

/**
 * Pages d'information (guide, légal, à propos, blog, pages métier) : toujours en clair,
 * quel que soit le thème du compte. Le thème clair est posé sur `<html>` pendant la page,
 * puis l'état d'avant (classes et `data-boot-theme`) est restauré tel quel en la quittant :
 * rien n'est écrit en stockage, rien n'est recalculé.
 */
export function useForcedLightTheme(): 'light' {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousClass = root.className;
    const previousBoot = root.getAttribute('data-boot-theme');
    applyTheme(root, 'light');
    return () => {
      root.className = previousClass;
      if (previousBoot === null) root.removeAttribute('data-boot-theme');
      else root.setAttribute('data-boot-theme', previousBoot);
    };
  }, []);
  return 'light';
}
