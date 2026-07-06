import React, { useEffect, useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLists, useCreateList } from '@/modules/lists';
import { resolveColor, InlineForm } from './shared';

interface BulkAddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Nombre de tâches sélectionnées — affiché dans le sous-titre. */
  count: number;
  /** Ajoute toutes les tâches sélectionnées à la liste (gère toast + sortie du mode sélection). */
  onAddToList: (listId: string) => void;
}

/**
 * Modal d'ajout à une liste pour la sélection multiple (#23).
 *
 * Remplace l'ancien DropdownMenu de la barre d'actions groupées, qui restait
 * désactivé quand aucune liste manuelle n'existait (bouton « Liste » sans
 * réaction). Ce modal s'ouvre toujours : il liste les listes manuelles et
 * permet d'en créer une à la volée (puis y ajoute la sélection).
 */
const BulkAddToListModal: React.FC<BulkAddToListModalProps> = ({ isOpen, onClose, count, onAddToList }) => {
  const { data: lists = [] } = useLists();
  const createListMutation = useCreateList();
  const [creating, setCreating] = useState(false);

  const manualLists = lists.filter((l) => l.type !== 'smart');

  useEffect(() => {
    if (!isOpen) setCreating(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (creating) { setCreating(false); return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, creating]);

  const handleCreate = (name: string, color: string) => {
    createListMutation.mutate(
      { name, color, type: 'manual' },
      { onSuccess: (newList) => { onAddToList(newList.id); onClose(); } }
    );
    setCreating(false);
  };

  const handlePick = (listId: string) => {
    onAddToList(listId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-add-to-list-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))]"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="bulk-add-to-list-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
                    Ajouter à une liste
                  </h2>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                    {count} tâche{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div data-scroll-area className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
              <AnimatePresence mode="wait">
                {creating ? (
                  <InlineForm
                    key="create-form"
                    onSave={handleCreate}
                    onCancel={() => setCreating(false)}
                    saveLabel="Créer et ajouter"
                  />
                ) : (
                  <motion.button
                    key="create-btn"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <Plus size={16} className="shrink-0" />
                    Nouvelle liste
                  </motion.button>
                )}
              </AnimatePresence>

              {manualLists.length === 0 && !creating && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Aucune liste manuelle pour l'instant.
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
                    Créez-en une pour y ranger votre sélection.
                  </p>
                </div>
              )}

              {manualLists.length > 0 && (
                <div className="border-t border-[rgb(var(--color-border))] mt-2 divide-y divide-[rgb(var(--color-border))]">
                  {manualLists.map((list) => {
                    const color = resolveColor(list.color);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => handlePick(list.id)}
                        className="w-full flex items-center gap-3 px-1 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="flex-1 min-w-0 text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                          {list.name}
                        </span>
                        <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                          {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rappel : les listes intelligentes ne peuvent pas recevoir de tâches manuellement */}
              {lists.some((l) => l.type === 'smart') && (
                <p className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text-muted))] px-1 pt-3">
                  <Sparkles size={10} aria-hidden="true" />
                  Les listes intelligentes se remplissent automatiquement.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkAddToListModal;
