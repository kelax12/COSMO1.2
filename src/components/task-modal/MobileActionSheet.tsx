// ═══════════════════════════════════════════════════════════════════
// La feuille d'action mobile de la fiche tâche
//
// FRONTIÈRE : `MobileActionSheet` porte l'ENVELOPPE (voile, feuille qui
// monte, poignée, titre, retrait sûr en bas d'écran). `MobileChoiceSheet`
// ajoute le cas de très loin le plus fréquent : choisir une valeur dans une
// liste, avec une coche sur celle qui est active.
//
// Aucun des deux ne sait ce qu'il choisit. La priorité, la récurrence et la
// catégorie s'en servaient avec trois copies du même bloc — mêmes classes,
// même voile, même poignée, seul le contenu changeait.
//
// ⚠️ Le mouvement vient de `useSheetMotion()`, jamais écrit à la main : une
// feuille animée à la main s'ouvre à 0 px visible sous
// `prefers-reduced-motion` (CLAUDE.md § Animations, garde
// `design-system.guard.test.ts`).
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { CellSeparator } from './primitives';

interface MobileActionSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Feuille à hauteur bornée et défilante — pour une liste qui peut être longue. */
  scrollable?: boolean;
  /** Borne de hauteur quand `scrollable` : 70 % par défaut, 80 % pour les
   *  collaborateurs (deux listes empilées, plus un champ de recherche). */
  maxHeightClass?: string;
  children: React.ReactNode;
}

export const MobileActionSheet = ({ open, title, onClose, scrollable = false, maxHeightClass = 'max-h-[70vh]', children }: MobileActionSheetProps) => {
  const sheetMotion = useSheetMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-[60] flex items-end"
          onClick={onClose}
        >
          <motion.div
            {...sheetMotion}
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-[rgb(var(--color-surface))] rounded-t-2xl overflow-hidden${
              scrollable ? ` ${maxHeightClass} flex flex-col` : ''
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className={`flex justify-center pt-3 pb-2${scrollable ? ' shrink-0' : ''}`}>
              <div className="w-9 h-1 rounded-full bg-[rgb(var(--color-border-strong))]" />
            </div>
            <p className={`text-[13px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-2${scrollable ? ' shrink-0' : ''}`}>
              {title}
            </p>
            {scrollable ? <div className="flex-1 overflow-y-auto">{children}</div> : children}
            <div className={`h-3${scrollable ? ' shrink-0' : ''}`} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ChoiceOption<T> {
  value: T;
  label: string;
  /** Classe de couleur du libellé (priorités), ou pastille (catégories). */
  labelClassName?: string;
  dotColor?: string;
}

interface MobileChoiceSheetProps<T> {
  open: boolean;
  title: string;
  onClose: () => void;
  options: ChoiceOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  scrollable?: boolean;
  /** Rendu après la liste — création en ligne d'une catégorie, par exemple. */
  footer?: React.ReactNode;
}

export function MobileChoiceSheet<T extends string | number>({
  open,
  title,
  onClose,
  options,
  selected,
  onSelect,
  scrollable,
  footer,
}: MobileChoiceSheetProps<T>) {
  return (
    <MobileActionSheet open={open} title={title} onClose={onClose} scrollable={scrollable}>
      {options.map((opt, i) => (
        <React.Fragment key={String(opt.value)}>
          {i > 0 && <CellSeparator />}
          <button
            type="button"
            onClick={() => onSelect(opt.value)}
            className="w-full flex items-center justify-between px-4 min-h-11 active:bg-[rgb(var(--color-hover))]"
          >
            {opt.dotColor ? (
              <span className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.dotColor }} />
                <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{opt.label}</span>
              </span>
            ) : (
              <span className={`text-[15px] ${opt.labelClassName ?? 'text-[rgb(var(--color-text-primary))]'}`}>{opt.label}</span>
            )}
            {selected === opt.value && <Check size={16} className="text-blue-500" />}
          </button>
        </React.Fragment>
      ))}
      {footer !== undefined && options.length > 0 && <CellSeparator />}
      {footer}
    </MobileActionSheet>
  );
}
