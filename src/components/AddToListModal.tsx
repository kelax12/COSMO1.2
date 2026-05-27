import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import {
  useLists,
  useAddTaskToList,
  useRemoveTaskFromList,
  useCreateList,
  useUpdateList,
  useDeleteList,
} from '@/modules/lists';

type AddToListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

const COLOR_PALETTE: { key: string; hex: string; label: string }[] = [
  { key: 'blue',   hex: '#3B82F6', label: 'Bleu' },
  { key: 'red',    hex: '#EF4444', label: 'Rouge' },
  { key: 'green',  hex: '#10B981', label: 'Vert' },
  { key: 'purple', hex: '#8B5CF6', label: 'Violet' },
  { key: 'orange', hex: '#F97316', label: 'Orange' },
  { key: 'yellow', hex: '#F59E0B', label: 'Jaune' },
  { key: 'pink',   hex: '#EC4899', label: 'Rose' },
  { key: 'indigo', hex: '#6366F1', label: 'Indigo' },
];

const colorMap: Record<string, string> = Object.fromEntries(
  COLOR_PALETTE.map((c) => [c.key, c.hex])
);
const resolveColor = (color: string) => colorMap[color] || color;

/* ─── Main component ─────────────────────────────────────────────────────── */
const AddToListModal: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const { data: lists = [] } = useLists();
  const addTaskToListMutation      = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation         = useCreateList();
  const updateListMutation         = useUpdateList();
  const deleteListMutation         = useDeleteList();

  const [editMode, setEditMode]               = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftList, setDraftList]             = useState<{ name: string; color: string } | null>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);

  const hasDraft = draftList !== null;

  /* Reset on close */
  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setConfirmDeleteId(null);
      setDraftList(null);
    }
  }, [isOpen]);

  /* Focus draft input when it appears */
  useEffect(() => {
    if (hasDraft) {
      requestAnimationFrame(() => draftInputRef.current?.focus());
    }
  }, [hasDraft]);

  /* ESC + body lock */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (draftList)       { setDraftList(null);       return; }
      if (confirmDeleteId) { setConfirmDeleteId(null); return; }
      if (editMode)        { setEditMode(false);       return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, editMode, draftList, confirmDeleteId]);

  /* Handlers */
  const handleToggle = (listId: string) => {
    if (editMode) return;
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    if (list.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId });
    } else {
      addTaskToListMutation.mutate({ taskId, listId });
    }
  };

  const handleCreate = () => {
    if (!draftList?.name.trim()) return;
    createListMutation.mutate({ name: draftList.name.trim(), color: draftList.color, type: 'manual' });
    setDraftList(null);
  };

  const cycleDraftColor = () => {
    setDraftList((d) => {
      if (!d) return null;
      const idx = COLOR_PALETTE.findIndex((c) => c.key === d.color);
      return { ...d, color: COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length].key };
    });
  };

  const handleConfirmDelete = (listId: string) => {
    deleteListMutation.mutate(listId);
    setConfirmDeleteId(null);
  };

  const manualLists = lists.filter((l) => l.type !== 'smart');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[80vh] bg-[rgb(var(--color-surface))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
            </div>

            {/* Header : titre + boutons */}
            <div className="flex items-center justify-between px-4 pb-2 shrink-0">
              <p id="add-to-list-title" className="text-[13px] font-semibold uppercase tracking-wider text-gray-500">
                Listes
              </p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setDraftList(hasDraft ? null : { name: '', color: 'blue' })}
                  aria-label="Nouvelle liste"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    hasDraft
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setEditMode((m) => !m); setConfirmDeleteId(null); }}
                  aria-label="Mode édition"
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    editMode
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'text-[rgb(var(--color-text-muted))] hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Pencil size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div data-scroll-area className="flex-1 overflow-y-auto px-4">

              {manualLists.length === 0 && !hasDraft && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">Aucune liste pour l'instant</p>
                </div>
              )}

              <div className="divide-y divide-[rgb(var(--color-border))]">
                {manualLists.map((list) => {
                  const isSelected = list.taskIds.includes(taskId);
                  const color      = resolveColor(list.color);
                  const isDeleting = confirmDeleteId === list.id;

                  /* ── Mode édition ── */
                  if (editMode) {
                    return (
                      <div key={list.id} className="flex items-center gap-3 px-1 py-2.5">
                        <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />

                        <input
                          type="text"
                          defaultValue={list.name}
                          onBlur={(e) => {
                            const newName = e.target.value.trim();
                            if (newName && newName !== list.name) {
                              updateListMutation.mutate({ id: list.id, updates: { name: newName, color: list.color } });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter')  e.currentTarget.blur();
                            if (e.key === 'Escape') { e.currentTarget.value = list.name; e.currentTarget.blur(); }
                          }}
                          className="flex-1 min-w-0 text-sm font-medium bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition-colors"
                        />

                        {isDeleting ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-7 px-2.5 rounded-md text-xs font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Non
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(list.id)}
                              className="h-7 px-2.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                              Supprimer
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(list.id)}
                            aria-label={`Supprimer ${list.name}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  }

                  /* ── Mode normal ── */
                  return (
                    <div
                      key={list.id}
                      className="flex items-center gap-3 px-1 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => handleToggle(list.id)}
                    >
                      <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                        <AnimatePresence>
                          {isSelected ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                              className="absolute inset-0 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: color }}
                            >
                              <Check size={11} className="text-white" strokeWidth={3} />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="dot"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          )}
                        </AnimatePresence>
                      </div>

                      <span className="flex-1 text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                        {list.name}
                      </span>
                      <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                        {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}

                {/* Ligne de création inline */}
                {hasDraft && (
                  <div className="flex items-center gap-3 px-1 py-2.5">
                    <button
                      type="button"
                      onClick={cycleDraftColor}
                      aria-label="Changer la couleur"
                      className="w-5 h-5 rounded-full shrink-0 transition-transform active:scale-90"
                      style={{ backgroundColor: resolveColor(draftList!.color) }}
                    />
                    <input
                      ref={draftInputRef}
                      type="text"
                      value={draftList!.name}
                      onChange={(e) => setDraftList((d) => d ? { ...d, name: e.target.value } : null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter'  && draftList!.name.trim()) handleCreate();
                        if (e.key === 'Escape') setDraftList(null);
                      }}
                      placeholder="Nom de la liste…"
                      className="flex-1 min-w-0 text-sm bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-gray-400 dark:placeholder-gray-600"
                    />
                    {draftList!.name.trim() ? (
                      <button type="button" onClick={handleCreate} aria-label="Créer" className="text-blue-500 shrink-0">
                        <Check size={16} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => setDraftList(null)} aria-label="Annuler" className="text-gray-400 shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 pt-3 pb-5 border-t border-[rgb(var(--color-border))] shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors"
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

export default AddToListModal;
