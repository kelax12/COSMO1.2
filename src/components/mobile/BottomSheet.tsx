import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FADE_TRANSITION, useSheetDrag, useSheetMotion } from './mobile-motion';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Libellé accessible du panneau (role="dialog"). */
  ariaLabel: string;
  className?: string;
}

/**
 * Feuille bas-d'écran sur mobile, dialogue centré sur desktop (`sm:` et plus).
 *
 * Extrait de la modale de choix Premium (PremiumPage) et de la structure
 * reprise à l'identique par les feuilles maison, au lieu de deux copies qui
 * divergeraient avec le temps, une seule brique. Cf. docs/MOBILE.md.
 */
export default function BottomSheet({ open, onClose, children, ariaLabel, className }: BottomSheetProps) {
  // Mouvement ET geste viennent des helpers du design system : c'est la
  // primitive, elle ne peut pas etre l'endroit ou la convention se reecrit
  // a la main. `useSheetDrag` porte les memes seuils (80 px OU 500 px/s) et
  // le meme retour haptique que la version qui vivait ici.
  const sheetMotion = useSheetMotion();
  const sheetDrag = useSheetDrag(onClose);
  // C-53 — `role`/`aria-modal` etaient deja poses ici, mais rien ne piegeait
  // le focus ni ne le rendait au declencheur, et Echap ne fermait pas : une
  // feuille annoncee comme modale sans en avoir le comportement clavier.
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose,
    label: ariaLabel,
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE_TRANSITION}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            key="sheet-panel"
            ref={panelRef}
            {...dialogProps}
            {...sheetMotion}
            {...sheetDrag}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full sm:max-w-md bg-[rgb(var(--color-surface))] sm:rounded-2xl rounded-t-sheet shadow-2xl flex flex-col max-h-[92vh]',
              className,
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sm:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
