import React, { useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useLists,
  useAddTaskToList,
  useRemoveTaskFromList,
  useCreateList,
  useUpdateList,
  useDeleteList,
} from '@/modules/lists';
import { AddToListModalProps, resolveColor, InlineForm } from './shared';

// ════════════════════════════════════════════════════════════════════════
// Desktop : design du commit bcddf61 — modal centré, InlineForm,
// liste avec dot + hover edit/delete. Sans drag ni bottom-sheet.
// ════════════════════════════════════════════════════════════════════════

const DesktopAddToList: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const { data: lists = [] } = useLists();
  const addTaskToListMutation      = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation         = useCreateList();
  const updateListMutation         = useUpdateList();
  const deleteListMutation         = useDeleteList();

  const [creating, setCreating]               = useState(false);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreating(false);
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editingId)         { setEditingId(null);        return; }
      if (creating)          { setCreating(false);         return; }
      if (confirmDeleteId)   { setConfirmDeleteId(null);   return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, editingId, creating, confirmDeleteId]);

  const handleToggle = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list || list.type === 'smart') return;
    if (list.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId });
    } else {
      addTaskToListMutation.mutate({ taskId, listId });
    }
  };

  const handleCreate = (name: string, color: string) => {
    createListMutation.mutate({ name, color, type: 'manual' });
    setCreating(false);
  };

  const handleSaveEdit = (name: string, color: string) => {
    if (!editingId) return;
    updateListMutation.mutate({ id: editingId, updates: { name, color } });
    setEditingId(null);
  };

  const handleConfirmDelete = (listId: string) => {
    deleteListMutation.mutate(listId);
    setConfirmDeleteId(null);
    if (editingId === listId) setEditingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
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
                  <h2
                    id="add-to-list-title"
                    className="text-lg font-semibold text-[rgb(var(--color-text-primary))]"
                  >
                    Ajouter à une liste
                  </h2>
                  <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                    {lists.filter(l => l.type !== 'smart').length}{' '}
                    {lists.filter(l => l.type !== 'smart').length <= 1 ? 'liste manuelle' : 'listes manuelles'}
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

              {/* Create button / form */}
              <AnimatePresence mode="wait">
                {creating ? (
                  <InlineForm
                    key="create-form"
                    onSave={handleCreate}
                    onCancel={() => setCreating(false)}
                    saveLabel="Créer"
                  />
                ) : (
                  <motion.button
                    key="create-btn"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    onClick={() => { setCreating(true); setEditingId(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                  >
                    <Plus size={16} className="shrink-0" />
                    Nouvelle liste
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {lists.length === 0 && !creating && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Aucune liste pour l'instant
                  </p>
                </div>
              )}

              {/* List items */}
              {lists.length > 0 && (
                <div className="border-t border-[rgb(var(--color-border))] mt-2 divide-y divide-[rgb(var(--color-border))]">
                  {lists.map((list) => {
                    const isSelected = list.taskIds.includes(taskId);
                    const color      = resolveColor(list.color);
                    const isSmart    = list.type === 'smart';
                    const isEditing  = editingId === list.id;
                    const isDeleting = confirmDeleteId === list.id;

                    if (isEditing) {
                      return (
                        <div key={list.id} className="py-2">
                          <InlineForm
                            initialName={list.name}
                            initialColor={list.color}
                            onSave={handleSaveEdit}
                            onCancel={() => setEditingId(null)}
                            saveLabel="Enregistrer"
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={list.id}
                        className="group flex items-center gap-3 px-1 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onClick={() => handleToggle(list.id)}
                      >
                        {/* Colour dot */}
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                            {list.name}
                          </span>
                          {isSmart && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              <Sparkles size={8} aria-hidden="true" />
                              Auto
                            </span>
                          )}
                          <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                            {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Right zone */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isDeleting ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="h-7 px-2.5 rounded-md text-xs font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                Non
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleConfirmDelete(list.id); }}
                                className="h-7 px-2.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                              >
                                Supprimer
                              </button>
                            </>
                          ) : (
                            <>
                              <AnimatePresence>
                                {isSelected && !isSmart && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="w-5 h-5 rounded-full flex items-center justify-center mr-1"
                                    style={{ backgroundColor: color }}
                                  >
                                    <Check size={11} className="text-white" strokeWidth={3} />
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {!isSmart && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditingId(list.id); setConfirmDeleteId(null); setCreating(false); }}
                                  aria-label={`Modifier ${list.name}`}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Pencil size={13} />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(list.id); }}
                                aria-label={`Supprimer ${list.name}`}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pt-3 pb-5 border-t border-[rgb(var(--color-border))] shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-10 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] transition-colors"
              >
                Terminer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DesktopAddToList;
