// src/components/org-guide/GuideCursor.tsx
import { motion, useReducedMotion } from 'framer-motion';

export interface CursorPoint { x: number; y: number }

/** Pointe de la flèche dans le viewBox : c'est elle qui doit tomber sur la cible. */
const TIP = { x: 3, y: 2 };

/**
 * Curseur de démo : violet à contour blanc, distinct de la vraie souris.
 * Seule couleur codée en dur du guide (maquette validée) : elle doit rester
 * identique dans tous les thèmes pour qu'on ne la confonde jamais avec l'UI.
 */
export function GuideCursor({ point, pressed }: { point: CursorPoint; pressed: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      aria-hidden="true"
      width={26}
      height={30}
      viewBox="0 0 26 30"
      className="pointer-events-none fixed left-0 top-0 z-[10020] drop-shadow-md"
      initial={false}
      animate={{ x: point.x - TIP.x, y: point.y - TIP.y, scale: pressed ? 0.85 : 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22, mass: 0.9 }}
    >
      <path d="M3 2 L3 24 L9 18 L13 27 L17 25 L13 16 L21 16 Z" fill="#534AB7" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </motion.svg>
  );
}
