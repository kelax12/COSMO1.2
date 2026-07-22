// Constantes de mouvement partagées du design system mobile.
//
// Avant : chaque bottom-sheet, chip et carte redéfinissait sa propre courbe.
// Résultat, deux surfaces qui s'ouvrent différemment dans la même app — ce que
// l'œil lit immédiatement comme « pas fini ». Une app native n'a qu'une poignée
// de courbes, réutilisées partout.
import type { Transition } from 'framer-motion';

/**
 * Ouverture/fermeture de feuille (bottom-sheet). Valeurs identiques à celles
 * déjà en place dans les modals — cf. docs/MOBILE.md § Modals.
 * Ne pas les changer sans revoir TOUS les sheets d'un coup.
 */
export const SHEET_SPRING: Transition = {
  type: 'spring',
  damping: 28,
  stiffness: 280,
};

/** Apparition/disparition d'un élément dans une liste. Court, discret. */
export const ITEM_TRANSITION: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 400,
  mass: 0.6,
};

/** Changement d'état d'un contrôle (onglet actif, chip sélectionnée). */
export const CONTROL_TRANSITION: Transition = {
  type: 'spring',
  damping: 32,
  stiffness: 500,
  mass: 0.5,
};

/** Fondu simple — quand un ressort serait du bruit (voiles, backdrops). */
export const FADE_TRANSITION: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] };

/**
 * Retour haptique léger. Ignoré silencieusement là où l'API n'existe pas
 * (iOS Safari ne l'implémente pas — le geste doit donc rester compréhensible
 * SANS vibration, jamais l'inverse).
 */
export function haptic(durationMs = 15): void {
  try {
    navigator.vibrate?.(durationMs);
  } catch {
    /* API absente ou bloquée par la politique de permissions */
  }
}

/**
 * `true` si l'utilisateur a demandé à réduire les animations.
 *
 * Windows expose ce réglage globalement : ne jamais conclure « l'animation ne
 * marche pas » sans l'avoir vérifié (cf. mémoire projet).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
