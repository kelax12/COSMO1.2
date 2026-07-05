// Aide raccourcis clavier (#48) — panneau ouvert par « ? » (hors champ de
// saisie) ou l'événement custom `open-shortcuts-help` (CommandPalette).
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['N'], label: 'Nouvelle tâche (quick-add en langage naturel)' },
  { keys: [IS_MAC ? '⌘' : 'Ctrl', 'K'], label: 'Palette de commandes (recherche globale, actions)' },
  { keys: ['/'], label: 'Rechercher dans la page Tâches' },
  { keys: ['G', 'puis T'], label: 'Aller aux Tâches (d = Accueil, a = Agenda, h = Habitudes, o = OKR, s = Stats)' },
  { keys: ['['], label: 'Replier / déplier la barre latérale' },
  { keys: ['↑', '↓'], label: 'Naviguer dans la liste de tâches (x = compléter, Entrée = ouvrir)' },
  { keys: ['?'], label: 'Afficher cette aide' },
  { keys: ['Échap'], label: 'Fermer le modal / la palette en cours' },
  { keys: ['Entrée'], label: 'Valider (dans le quick-add : créer et enchaîner)' },
];

const ShortcutsHelp = () => {
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
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onOpenEvent = () => setIsOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-shortcuts-help', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-shortcuts-help', onOpenEvent);
    };
  }, []);

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
            role="dialog"
            aria-label="Raccourcis clavier"
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
            <ul className="px-5 py-4 space-y-3">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{s.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-1 rounded-md border text-xs font-semibold"
                        style={{
                          borderColor: 'rgb(var(--color-border))',
                          backgroundColor: 'rgb(var(--color-hover))',
                          color: 'rgb(var(--color-text-primary))',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-5 pb-4 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
              Les raccourcis sont inactifs pendant la saisie dans un champ.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShortcutsHelp;
