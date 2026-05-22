import { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * <BottomSheet> — primitive iOS-style bottom sheet (mobile) / centered modal (desktop).
 *
 * Implémente le pattern documenté dans CLAUDE.md (Mobile-first → Modals) :
 * - Bottom-sheet sur mobile, dialog centré sur desktop (≥sm)
 * - ESC + clic backdrop + drag-to-close
 * - Verrouillage `body.overflow`
 * - Sticky header / footer optionnels, body scrollable
 * - safe-area-inset-bottom respecté
 *
 * Usage minimal :
 *   <BottomSheet isOpen={open} onClose={close} title="Titre">contenu</BottomSheet>
 *
 * Usage avancé :
 *   <BottomSheet isOpen={open} onClose={close} maxWidth="lg"
 *     header={<MyHeader />} footer={<MyFooter />}>
 *     ...
 *   </BottomSheet>
 */
export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Titre simple (utilise le header par défaut). Ignoré si `header` est fourni. */
  title?: string;
  /** Header custom (override le rendu par défaut). */
  header?: ReactNode;
  /** Footer sticky optionnel. */
  footer?: ReactNode;
  /** Max-width desktop. `md` = max-w-md (default), `lg` = max-w-lg, `xl` = max-w-xl, `2xl` = max-w-2xl. */
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl';
  /** Désactive le drag-to-close mobile (ex. modals avec scroll horizontal interne). */
  disableDrag?: boolean;
  /** Classes additionnelles sur le conteneur du sheet. */
  className?: string;
  /** aria-label pour accessibilité quand `title` est absent. */
  ariaLabel?: string;
}

const MAX_WIDTH_CLASS = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
} as const;

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  header,
  footer,
  maxWidth = 'md',
  disableDrag = false,
  className,
  ariaLabel,
}: BottomSheetProps) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
        >
          <motion.div
            drag={disableDrag ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full bg-[rgb(var(--color-surface))] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh]',
              MAX_WIDTH_CLASS[maxWidth],
              className
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle mobile only */}
            {!disableDrag && (
              <div
                className="sm:hidden flex justify-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}

            {/* Header */}
            {header ? (
              <div className="shrink-0">{header}</div>
            ) : title ? (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[rgb(var(--color-border))] shrink-0 flex items-center justify-between">
                <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                  aria-label="Fermer"
                >
                  <X size={20} className="text-[rgb(var(--color-text-muted))]" />
                </button>
              </div>
            ) : null}

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-4 sm:px-6 pt-3 pb-3 border-t border-[rgb(var(--color-border))] shrink-0 flex flex-col-reverse sm:flex-row gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BottomSheet;
