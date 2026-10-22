import { useState } from 'react';

/**
 * Vrai à partir de la première fois que `active` l'a été, puis pour toujours.
 *
 * Sert à monter un composant `React.lazy` seulement quand on en a besoin
 * (son chunk n'est téléchargé qu'à la première ouverture), puis à le GARDER
 * monté : une feuille démontée à la fermeture perdrait son animation de
 * sortie, que `AnimatePresence` joue à l'intérieur du composant.
 *
 * C-117 · c'est ce qui sort les feuilles « à la demande » du chunk `TasksPage`.
 */
export function useLazyMount(active: boolean): boolean {
  const [mounted, setMounted] = useState(active);
  // État dérivé pendant le rendu : React le recommande plutôt qu'un effet,
  // qui ferait un rendu de plus AVANT le montage.
  if (active && !mounted) setMounted(true);
  return mounted || active;
}
