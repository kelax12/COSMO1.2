import { useEffect, useState } from 'react';
import { readJson, safeSetItem } from '@/lib/safe-json';

const STORAGE_KEY = 'org-nav-collapsed';

/**
 * État replié de la navigation entreprise (desktop).
 *
 * Il vit dans la PAGE et pas dans `OrgSideNav` : la page réserve la place du
 * panneau ouvert (sinon la carte flottante recouvrirait la colonne de droite
 * du contenu) et doit donc savoir s'il l'est.
 *
 * Ouvert par défaut. Lecture tolérante : une valeur corrompue ou un stockage
 * refusé ne doit pas fermer la page (B14).
 */
export function useOrgNavCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => readJson<boolean>(STORAGE_KEY) === true);

  useEffect(() => {
    safeSetItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  // Raccourci « ] » : symétrique du « [ » qui replie la sidebar de gauche
  // (`Layout.tsx`), avec la même garde contre les champs de saisie.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return [collapsed, setCollapsed];
}
