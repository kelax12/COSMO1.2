import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import type { TaskList } from '@/modules/lists';

export interface ListColorOption {
  value: string;
  color: string;
  name: string;
}

interface ListActionsSheetProps {
  list: TaskList | null;
  colorOptions: ListColorOption[];
  resolveListColor: (color: string) => string;
  onClose: () => void;
  onRename: (list: TaskList) => void;
  onToggleDefault: (list: TaskList) => void;
  onDelete: (list: TaskList) => void;
  onPickColor: (list: TaskList, colorValue: string) => void;
}

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
  const currentColor = list ? resolveListColor(list.color) : '#3B82F6';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  const content = (
    <AnimatePresence>
      {list && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.65 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full flex flex-col"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              borderRadius: '20px 20px 0 0',
            }}
            role="dialog"
            aria-label={`Actions pour la liste ${list.name}`}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-9 h-[4px] rounded-full" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
            </div>

            {/* Header — nom + pastille couleur, compact */}
            <div className="flex items-center gap-2.5 px-5 pb-3">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: currentColor }}
              />
              <span
                className="text-[13px] font-semibold uppercase tracking-wider truncate"
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                {list.name}
              </span>
            </div>

            {/* Séparateur */}
            <div className="h-px mx-0" style={{ backgroundColor: 'rgb(var(--color-border))' }} />

            {/* Palette couleur — petits cercles compacts, masquée pour smart */}
            {!isSmart && (
              <>
                <div className="px-5 py-3.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {colorOptions.map((opt) => {
                      const selected = list.color === opt.value ||
                        (list.color.startsWith('#') && list.color.toLowerCase() === opt.color.toLowerCase());
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onPickColor(list, opt.value)}
                          aria-label={opt.name}
                          aria-pressed={selected}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-full"
                          style={{ ['--tw-ring-color' as string]: opt.color }}
                        >
                          <span
                            className="w-[26px] h-[26px] rounded-full transition-transform"
                            style={{
                              backgroundColor: opt.color,
                              boxShadow: selected
                                ? `0 0 0 2.5px rgb(var(--color-surface)), 0 0 0 4.5px ${opt.color}`
                                : 'none',
                              transform: selected ? 'scale(1.15)' : 'scale(1)',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
              </>
            )}

            {/* Actions — style iOS natif : icône nue + texte, séparateurs fins */}
            <div>
              {/* Renommer */}
              {!isSmart && (
                <>
                  <button
                    type="button"
                    onClick={() => { onRename(list); onClose(); }}
                    className="w-full flex items-center gap-4 px-5 min-h-[54px] text-left active:opacity-50 transition-opacity"
                  >
                    <Pencil
                      size={17}
                      strokeWidth={1.75}
                      aria-hidden="true"
                      style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }}
                    />
                    <span className="text-[16px]" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      Renommer
                    </span>
                  </button>
                  <div className="h-px ml-[60px]" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                </>
              )}

              {/* Épingler / Désépingler */}
              <button
                type="button"
                onClick={() => { onToggleDefault(list); onClose(); }}
                className="w-full flex items-center gap-4 px-5 min-h-[54px] text-left active:opacity-50 transition-opacity"
              >
                {list.isDefault
                  ? <PinOff size={17} strokeWidth={1.75} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                  : <Pin    size={17} strokeWidth={1.75} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                }
                <span className="text-[16px]" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {list.isDefault ? 'Retirer des favoris' : 'Épingler par défaut'}
                </span>
              </button>
            </div>

            {/* Supprimer — groupe séparé, rouge */}
            <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
            <div
              className="mx-4 my-3 rounded-xl overflow-hidden"
              style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}
            >
              <button
                type="button"
                onClick={() => { onDelete(list); onClose(); }}
                className="w-full flex items-center gap-4 px-4 min-h-[50px] text-left active:opacity-50 transition-opacity"
              >
                <Trash2 size={17} strokeWidth={1.75} aria-hidden="true" className="text-red-500 shrink-0" />
                <span className="text-[16px] text-red-500">
                  Supprimer
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
