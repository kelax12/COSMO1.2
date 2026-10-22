import { useEffect, useState } from 'react';

/**
 * État de la navigation entreprise (desktop). Trois états, pas deux :
 *
 * - `open`     : ouverte À L'ARRIVÉE sur la page, toujours (demande d'Axel du
 *                2026-09-23). La page lui réserve sa place.
 * - `collapsed`: repliée, 10 px au bord.
 * - `peek`     : ressortie parce que le curseur a touché le bord. Elle passe
 *                PAR-DESSUS le contenu, sans réserver de place : réserver à
 *                chaque survol ferait sauter la page à chaque passage.
 *
 * Quitter la carte au curseur la replie (cf. `OrgSideNav`).
 *
 * ⚠️ Plus de mémorisation : l'état n'est pas relu du stockage, parce que la
 * carte doit être ouverte à chaque arrivée, quel qu'ait été l'état au départ.
 *
 * Il vit dans la PAGE et pas dans `OrgSideNav` : c'est la page qui réserve la
 * place en mode `open`.
 */
export type OrgNavMode = 'open' | 'collapsed' | 'peek';

export function useOrgNavMode(): [OrgNavMode, (next: OrgNavMode) => void] {
  const [mode, setMode] = useState<OrgNavMode>('open');

  // Raccourci « ] » : symétrique du « [ » qui replie la sidebar de gauche
  // (`Layout.tsx`), avec la même garde contre les champs de saisie.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        setMode((prev) => (prev === 'collapsed' ? 'open' : 'collapsed'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return [mode, setMode];
}
