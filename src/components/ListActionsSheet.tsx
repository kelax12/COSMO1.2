import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Pin, PinOff, Trash2, Check } from 'lucide-react';
import type { TaskList } from '@/modules/lists';

export interface ListColorOption {
  value: string;
  color: string;
  name: string;
}

interface ListActionsSheetProps {
  /** Liste ciblée, ou null pour fermé. */
  list: TaskList | null;
  colorOptions: ListColorOption[];
  resolveListColor: (color: string) => string;
  onClose: () => void;
  onRename: (list: TaskList) => void;
  onToggleDefault: (list: TaskList) => void;
  onDelete: (list: TaskList) => void;
  onPickColor: (list: TaskList, colorValue: string) => void;
}

/**
 * Menu contextuel d'actions de liste — bottom-sheet déclenché par appui long
 * sur une chip de liste (mobile). Remplace les micro-boutons flottants hover-only
 * (inaccessibles au tap) par des cibles ≥ 44 px conformes WCAG 2.5.5.
 *
 * Pattern bottom-sheet standard du projet : portal + items-end, drag handle,
 * safe-area, ESC + backdrop pour fermer. Les smart lists masquent Renommer/Couleur
 * (leur règle est figée), comme sur desktop.
 */
const ListActionsSheet: React.FC<ListActionsSheetProps> = ({
  list,
  colorOptions,
  resolveListColor,
  onClose,
  onRename,
  onToggleDefault,
  onDelete,
  onPickColor,
}) => {
  const isOpen = !!list;
  const isSmart = list?.type === 'smart';

  // ESC pour fermer + verrou scroll body pendant l'ouverture.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const content = (
    <AnimatePresence>
      {list && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 30, stiffness: 320, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl shadow-2xl flex flex-col"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            role="dialog"
            aria-label={`Actions pour la liste ${list.name}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1.5">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Header : pastille + nom */}
            <div className="flex items-center gap-2.5 px-5 pt-1 pb-3 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0"
                style={{ backgroundColor: resolveListColor(list.color) }}
              />
              <span className="font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {list.name}
              </span>
            </div>

            <div className="px-3 py-2">
              {/* Palette couleur — masquée pour les smart lists (règle figée) */}
              {!isSmart && (
                <div className="px-2 py-2">
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Couleur
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {colorOptions.map((opt) => {
                      const selected = list.color === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onPickColor(list, opt.value)}
                          aria-label={`Couleur ${opt.name}`}
                          aria-pressed={selected}
                          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg transition-colors active:bg-slate-100 dark:active:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-700 shadow-sm"
                            style={{ backgroundColor: opt.color }}
                          >
                            {selected && <Check size={14} className="text-white" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Renommer — masqué pour les smart lists */}
              {!isSmart && (
                <button
                  type="button"
                  onClick={() => { onRename(list); onClose(); }}
                  className="w-full flex items-center gap-3.5 px-2 min-h-[52px] rounded-lg text-left transition-colors active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Pencil size={18} aria-hidden="true" />
                  </span>
                  <span className="text-[15px] font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    Renommer
                  </span>
                </button>
              )}

              {/* Épingler / Désépingler par défaut */}
              <button
                type="button"
                onClick={() => { onToggleDefault(list); onClose(); }}
                className="w-full flex items-center gap-3.5 px-2 min-h-[52px] rounded-lg text-left transition-colors active:bg-slate-100 dark:active:bg-slate-800"
              >
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {list.isDefault ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
                </span>
                <span className="text-[15px] font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {list.isDefault ? 'Retirer des listes par défaut' : 'Épingler comme liste par défaut'}
                </span>
              </button>

              {/* Supprimer */}
              <button
                type="button"
                onClick={() => { onDelete(list); onClose(); }}
                className="w-full flex items-center gap-3.5 px-2 min-h-[52px] rounded-lg text-left transition-colors active:bg-red-50 dark:active:bg-red-900/20"
              >
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10 text-red-600 dark:text-red-400">
                  <Trash2 size={18} aria-hidden="true" />
                </span>
                <span className="text-[15px] font-medium text-red-600 dark:text-red-400">
                  Supprimer la liste
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default ListActionsSheet;
