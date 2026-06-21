import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';
import { ArrowSide } from './types';

// ───────────────────────────────────────────────────────────────────
// Flèche animée
// ───────────────────────────────────────────────────────────────────
const TutorialArrow: React.FC<{ side: ArrowSide; color: string }> = ({ side, color }) => {
  // Anim spring vers le centre de la cible (légère bobine)
  const variants: Record<ArrowSide, { initial: { x?: number; y?: number }; animate: { x?: number; y?: number } }> = {
    top:    { initial: { y: -30 }, animate: { y: 0 } },
    bottom: { initial: { y:  30 }, animate: { y: 0 } },
    left:   { initial: { x: -30 }, animate: { x: 0 } },
    right:  { initial: { x:  30 }, animate: { x: 0 } },
  };

  const Icon = side === 'top' ? ArrowDown
             : side === 'bottom' ? ArrowUp
             : side === 'left' ? ArrowRight
             : ArrowLeft;

  return (
    <motion.div
      initial={variants[side].initial}
      animate={variants[side].animate}
      transition={{ duration: 0.9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      style={{ color }}
      className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
    >
      <Icon size={44} strokeWidth={3} />
    </motion.div>
  );
};

export default TutorialArrow;
