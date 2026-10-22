import { useEffect, useState } from 'react';

/**
 * Vrai dès la première ouverture d'une surface, et le reste.
 *
 * Sert aux surfaces chargées à la demande qui ANIMENT leur fermeture (feuilles,
 * modales) : non montées tant qu'on ne les a jamais ouvertes, donc hors du
 * chunk de la page, mais gardées ensuite, sinon elles disparaîtraient d'un coup
 * au lieu de glisser. Utilisé par `pages/agenda/lazy-overlays.tsx` et
 * `pages/okr/lazy-dialogs.tsx` (budget de bundle, 2026-10-11).
 */
export function useMountedAfterFirstOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return mounted || open;
}
