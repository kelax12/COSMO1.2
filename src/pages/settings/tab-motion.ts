import type { MotionProps } from 'framer-motion';

/**
 * Entrée et sortie d'un onglet des paramètres. Sous prefers-reduced-motion,
 * l'exit d'un onglet ne signale jamais sa fin à AnimatePresence (bug Framer
 * Motion) : sans `exit`/`initial`, le montage/démontage redevient synchrone,
 * comme un rendu conditionnel classique.
 */
export const tabMotion = (reduced: boolean | null): MotionProps => ({
  initial: reduced ? false : { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: reduced ? undefined : { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
});
