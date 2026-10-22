// Aide raccourcis clavier (#48) — panneau ouvert par « ? » (hors champ de
// saisie) ou l'événement custom `open-shortcuts-help` (CommandPalette).
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { ShortcutsList } from './keyboard-shortcuts';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

const ShortcutsHelp = () => {
  const ov = useT('overlays');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        setIsOpen(v => !v);
      }
    };
    const onOpenEvent = () => setIsOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-shortcuts-help', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-shortcuts-help', onOpenEvent);
    };
  }, []);

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Le nom accessible est celui que la surface portait deja.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose: () => setIsOpen(false),
    label: "Raccourcis clavier",
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            ref={modalA11yRef}
            {...modalA11yProps}
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
              <h2 className="flex items-center gap-2 text-base font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                <Keyboard size={18} className="text-blue-500" aria-hidden="true" />
                Raccourcis clavier
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              <ShortcutsList />
            </div>
            <p className="px-5 pb-4 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {ov.t('shortcuts.inactiveWhileTyping')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShortcutsHelp;
