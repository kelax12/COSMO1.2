import { useEffect, useState } from 'react';
import type { Theme } from '@/lib/theme';
import { moduleColorsFor, type ModuleColors } from '@/lib/module-colors';

/** Thème posé sur `<html>` par `applyTheme` (classes `dark`, `gris`, `noir`). */
export function readDocumentTheme(root?: HTMLElement): Theme {
  // Sans document : le rendu serveur de la copie du guide (src/prerender/content-copy.tsx).
  if (!root && typeof document === 'undefined') return 'light';
  const c = (root ?? document.documentElement).classList;
  if (c.contains('noir')) return 'noir';
  if (c.contains('gris')) return 'gris';
  if (c.contains('dark')) return 'dark';
  return 'light';
}

/**
 * Le thème effectivement affiché, suivi en direct.
 *
 * `useDarkMode` tient un état LOCAL à chaque composant qui l'appelle : une page
 * qui ne porte pas le bouton de thème ne le verrait pas changer. La source qui
 * fait foi est la classe de `<html>`, d'où l'observation de cet attribut.
 */
export function useDocumentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(() => readDocumentTheme());
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readDocumentTheme(root)));
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTheme(readDocumentTheme(root));
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** Couleurs de module du thème affiché (adoucies en Gris, cf. module-colors). */
export function useModuleColors(): ModuleColors {
  return moduleColorsFor(useDocumentTheme());
}
