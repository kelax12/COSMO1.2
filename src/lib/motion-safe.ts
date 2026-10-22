import { useReducedMotion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════
// motion-safe — entrées animées qui ne cassent pas la mise en page.
//
// `App.tsx` monte `<MotionConfig reducedMotion="user">`. Chez un utilisateur
// en `prefers-reduced-motion`, les animations de transform ne jouent pas —
// mais la valeur `initial` reste appliquée. Un composant écrit ainsi :
//
//   initial={{ y: 120 }} animate={{ y: 0 }}
//
// reste donc figé 120 px plus bas, définitivement. Mesuré le 2026-08-14 sur
// `CookieBanner` et `DemoBridgePrompt` : leur bouton d'action sortait de
// l'écran sur mobile, et aucun scroll ne pouvait le ramener puisque ces
// éléments sont en `position: fixed`.
//
// Le réglage censé aider les personnes sensibles au mouvement cassait donc la
// mise en page pour elles, et pour elles seules — d'où la survie du défaut :
// il est invisible sur une machine sans le réglage.
//
// RÈGLE : la position finale vient du CSS, l'animation ne porte que ce qui
// est purement décoratif. Sous `prefers-reduced-motion`, ce helper ne produit
// AUCUN transform — pas même `y: 0` — pour qu'aucune valeur résiduelle ne
// puisse s'appliquer.
// ═══════════════════════════════════════════════════════════════════

type MotionEntrance = {
  initial: { y?: number; opacity: number };
  animate: { y?: number; opacity: number };
  exit: { y?: number; opacity: number };
};

/**
 * Entrée « glisse depuis le bas » pour une surface positionnée en CSS
 * (bannière, feuille, toast). Dégrade en simple fondu quand l'utilisateur
 * demande moins de mouvement.
 *
 * @param offset décalage vertical d'entrée en px (ignoré en reduced-motion).
 */
export function useSlideUpEntrance(offset = 120): MotionEntrance {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    // Aucun `y` : ni dans `initial`, ni dans `animate`. Le composant se place
    // exactement où son CSS le met.
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  return {
    initial: { y: offset, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: offset, opacity: 0 },
  };
}
