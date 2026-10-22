import { useLayoutEffect, useState } from 'react';
import { prerenderHeroShown, releasePrerenderHero } from '@/lib/prerender-hero';

/**
 * Relève de la copie du hero peinte par le prérendu de la home
 * (`@/lib/prerender-hero`). À appeler par le composant qui peint le hero, et
 * par lui seul : c'est son `useLayoutEffect` qui retire la copie, dans l'image
 * où ce hero est peint, donc sans saut.
 *
 * Rend `true` si la copie était à l'écran au premier rendu : ce qu'elle
 * montrait déjà (titre, sous-titre, CTA) ne doit alors pas rejouer son entrée,
 * sinon il disparaîtrait sous les yeux du visiteur pour réapparaître. Le reste
 * (tuile, puces, filets), masqué dans la copie, entre normalement.
 *
 * Hors de `@/lib/prerender-hero` exprès : `boot.ts` importe ce module, et un
 * import de React l'aurait mis sur le chemin du LCP.
 */
export function usePrerenderHeroTakeover(): boolean {
  const [reprise] = useState(prerenderHeroShown);
  useLayoutEffect(() => {
    releasePrerenderHero();
  }, []);
  return reprise;
}
