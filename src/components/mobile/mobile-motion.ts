// Constantes de mouvement partagées du design system mobile.
//
// Avant : chaque bottom-sheet, chip et carte redéfinissait sa propre courbe.
// Résultat, deux surfaces qui s'ouvrent différemment dans la même app — ce que
// l'œil lit immédiatement comme « pas fini ». Une app native n'a qu'une poignée
// de courbes, réutilisées partout.
import { useReducedMotion, type Transition, type Variants } from 'framer-motion';

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

/**
 * Variantes d'entrée/sortie d'une feuille, SÛRES sous `prefers-reduced-motion`.
 *
 * ⚠️ CE N'EST PAS UNE PRÉFÉRENCE DE STYLE — c'est un correctif de bug.
 *
 * `App.tsx` monte `<MotionConfig reducedMotion="user">`. Chez un utilisateur en
 * mouvement réduit, Framer NE JOUE PAS les animations de transform et la valeur
 * `initial` RESTE APPLIQUÉE. Un `initial={{ y: '100%' }} animate={{ y: 0 }}` sur
 * une feuille `fixed bottom-0` la laisse donc à 100 % sous l'écran, pour
 * toujours.
 *
 * MESURÉ dans le navigateur le 2026-08-24, `prefers-reduced-motion: reduce`
 * actif, viewport 375×812, mode démo : `MobileMoreSheet` (« Plus d'options »)
 * s'ouvrait à `transform: matrix(1, 0, 0, 1, 0, 510)`, soit `top: 812` pour un
 * viewport de 812 — **hauteur visible : 0 px**. Le voile s'affichait, la feuille
 * non. Or c'est le SEUL accès mobile à OKR, Statistiques, Paramètres et à la
 * déconnexion : la navigation mobile était sans issue pour ces utilisateurs.
 *
 * La règle (CLAUDE.md § Animations) : la position finale vient du CSS,
 * l'animation ne porte que sur l'opacité. Ce helper l'applique une fois pour
 * toutes, au lieu de la faire retenir à chaque feuille.
 *
 * Usage :
 *   const sheet = useSheetMotion();
 *   <motion.div {...sheet} className="fixed bottom-0 …" />
 */
export function useSheetMotion() {
  const reduce = useReducedMotion();
  if (reduce) {
    // Aucune clé de transform : rien ne peut rester coincé sur `initial`.
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: FADE_TRANSITION,
    } as const;
  }
  return {
    initial: { y: '100%' as const, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%' as const, opacity: 0 },
    transition: SHEET_SPRING,
  } as const;
}

/**
 * Variantes « conteneur + items » d'une apparition en cascade, SÛRES sous
 * `prefers-reduced-motion`.
 *
 * Même bug que `useSheetMotion`, en moins visible et donc en plus durable :
 * avec `staggerChildren`, les enfants restent sur leur variante `hidden`
 * lorsque la clé animée est un transform. MESURÉ le 2026-08-24 sur
 * `/dashboard` en mouvement réduit : **dix blocs figés à
 * `transform: matrix(1, 0, 0, 1, 0, 20)`**, soit 20 px trop bas, définitivement.
 *
 * 20 px ne casse pas la page — c'est justement pour ça que ça n'a jamais été
 * vu. Mais c'est le MÊME défaut que celui qui rendait `MobileMoreSheet`
 * totalement inaccessible : la position d'arrivée dépendait d'une animation de
 * transform.
 *
 * Sous mouvement réduit, on ne garde que l'opacité et on retire la cascade
 * (une cascade est du mouvement, même sans transform).
 */
export function useRevealVariants(offset = 20): { container: Variants; item: Variants } {
  const reduce = useReducedMotion();

  if (reduce) {
    return {
      container: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
      // Aucune clé de transform : rien ne peut rester coincé sur `hidden`.
      item: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
    };
  }

  return {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
    },
    item: {
      hidden: { opacity: 0, y: offset },
      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
    },
  };
}

/**
 * Geste « glisser vers le bas pour fermer » d'une feuille.
 *
 * POURQUOI CE HELPER. L'audit mobile du 2026-08-14 a compté ONZE feuilles
 * réimplémentées à la main contre deux qui utilisent la primitive `BottomSheet`
 * — et surtout : **cinq affichaient une poignée de glissement qui ne faisait
 * rien**. Une affordance qui promet un geste inexistant est moins bonne que pas
 * d'affordance du tout : l'utilisateur tire, rien ne bouge, et il en conclut que
 * l'app est cassée.
 *
 * Les valeurs sont celles de `BottomSheet` (80 px de course OU 500 px/s de
 * vélocité), pour que toutes les feuilles se ferment au même geste.
 *
 * Usage :
 *   const drag = useSheetDrag(onClose);
 *   <motion.div {...drag} className="…">  // + une poignée visible
 */
export function useSheetDrag(onClose: () => void) {
  return {
    drag: 'y' as const,
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: 0, bottom: 0.4 },
    onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 80 || info.velocity.y > 500) {
        haptic(10);
        onClose();
      }
    },
  };
}
