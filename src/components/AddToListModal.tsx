import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Sparkles, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useIsMobile } from '@/lib/hooks/use-mobile';
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

// ════════════════════════════════════════════════════════════════════════
// Desktop : design custom — tuiles en grille 2 colonnes, recherche en
// haut, création inline depuis le « + » dans le header. Toggle au clic
// sur la tuile ; icônes edit/delete révélées au hover.
// ════════════════════════════════════════════════════════════════════════

const DesktopAddToList: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const { data: lists = [] } = useLists();
  const addTaskToListMutation    = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<{ name: string; color: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setDraft(null);
      setEditing(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (draft) requestAnimationFrame(() => draftInputRef.current?.focus());
  }, [draft]);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => editInputRef.current?.focus());
  }, [editing]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editing)         { setEditing(null);         return; }
      if (draft)           { setDraft(null);           return; }
      if (confirmDeleteId) { setConfirmDeleteId(null); return; }
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, draft, editing, confirmDeleteId]);

  const manualLists = lists.filter((l) => l.type !== 'smart');
  const filteredLists = manualLists.filter((l) =>
    l.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleToggle = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list || list.type === 'smart') return;
    if (list.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId });
    } else {
      addTaskToListMutation.mutate({ taskId, listId });
    }
  };

  const handleCreateDraft = () => {
    if (!draft || !draft.name.trim()) return;
    createListMutation.mutate({ name: draft.name.trim(), color: draft.color, type: 'manual' });
    setDraft(null);
  };

  const handleSaveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    updateListMutation.mutate({
      id: editing.id,
      updates: { name: editing.name.trim(), color: editing.color },
    });
    setEditing(null);
  };

  const handleConfirmDelete = (listId: string) => {
    deleteListMutation.mutate(listId);
    setConfirmDeleteId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-[rgb(var(--color-border))] shrink-0">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 id="add-to-list-title" className="text-base font-semibold text-[rgb(var(--color-text-primary))] truncate">
                      Ajouter à une liste
                    </h2>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">
                      {manualLists.length} {manualLists.length <= 1 ? 'liste' : 'listes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setDraft(draft ? null : { name: '', color: 'blue' }); setEditing(null); setConfirmDeleteId(null); }}
                    aria-label={draft ? 'Annuler la création' : 'Nouvelle liste'}
                    aria-pressed={!!draft}
                    className={`h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      draft
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    <Plus size={15} />
                    Nouvelle
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Search */}
              {manualLists.length > 3 && !draft && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une liste…"
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))]"
                  />
                </div>
              )}
            </div>

            {/* Body */}
            <div data-scroll-area className="flex-1 overflow-y-auto p-4">

              {/* Inline draft form (création) */}
              <AnimatePresence>
                {draft && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mb-3 overflow-hidden"
                  >
                    <div className="rounded-xl border-2 border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: resolveColor(draft.color) }}
                        />
                        <input
                          ref={draftInputRef}
                          type="text"
                          value={draft.name}
                          onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && draft.name.trim()) handleCreateDraft();
                            if (e.key === 'Escape') setDraft(null);
                          }}
                          placeholder="Nom de la nouvelle liste…"
                          className="flex-1 min-w-0 h-8 px-2 rounded-md bg-transparent text-sm font-medium focus:outline-none text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))]"
                          style={{ border: 'none' }}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pl-5">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setDraft((d) => d ? { ...d, color: c.key } : null)}
                            aria-label={`Couleur ${c.label}`}
                            aria-pressed={draft.color === c.key}
                            className={`w-5 h-5 rounded-full transition-transform ${draft.color === c.key ? 'scale-125 ring-2 ring-offset-2 ring-offset-[rgb(var(--color-surface))]' : 'hover:scale-110'}`}
                            style={{
                              backgroundColor: c.hex,
                              boxShadow: draft.color === c.key ? `0 0 0 2px ${c.hex}` : undefined,
                            }}
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setDraft(null)}
                          className="h-8 px-3 rounded-md text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateDraft}
                          disabled={!draft.name.trim()}
                          className="h-8 px-3 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Créer la liste
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {manualLists.length === 0 && !draft && (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mx-auto mb-3">
                    <Plus size={20} className="text-[rgb(var(--color-text-muted))]" />
                  </div>
                  <p className="text-sm font-medium text-[rgb(var(--color-text-primary))] mb-1">Aucune liste</p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    Crée ta première liste avec le bouton « Nouvelle » ci-dessus
                  </p>
                </div>
              )}

              {/* No search result */}
              {manualLists.length > 0 && filteredLists.length === 0 && search.trim() && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Aucune liste ne correspond à « {search} »
                  </p>
                </div>
              )}

              {/* Grid de tuiles */}
              {filteredLists.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredLists.map((list) => {
                    const isSelected = list.taskIds.includes(taskId);
                    const color      = resolveColor(list.color);
                    const isEditing  = editing?.id === list.id;
                    const isDeleting = confirmDeleteId === list.id;

                    if (isEditing && editing) {
                      return (
                        <div
                          key={list.id}
                          className="col-span-2 rounded-xl border-2 border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-3"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: resolveColor(editing.color) }}
                            />
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editing.name}
                              onChange={(e) => setEditing((s) => s ? { ...s, name: e.target.value } : null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editing.name.trim()) handleSaveEdit();
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              className="flex-1 min-w-0 h-8 px-2 rounded-md bg-transparent text-sm font-medium focus:outline-none text-[rgb(var(--color-text-primary))]"
                              style={{ border: 'none' }}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap pl-5">
                            {COLOR_PALETTE.map((c) => (
                              <button
                                key={c.key}
                                type="button"
                                onClick={() => setEditing((s) => s ? { ...s, color: c.key } : null)}
                                aria-label={`Couleur ${c.label}`}
                                aria-pressed={editing.color === c.key}
                                className={`w-5 h-5 rounded-full transition-transform ${editing.color === c.key ? 'scale-125' : 'hover:scale-110'}`}
                                style={{
                                  backgroundColor: c.hex,
                                  boxShadow: editing.color === c.key ? `0 0 0 2px ${c.hex}` : undefined,
                                }}
                              />
                            ))}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="h-8 px-3 rounded-md text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={!editing.name.trim()}
                              className="h-8 px-3 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
                            >
                              Enregistrer
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (isDeleting) {
                      return (
                        <div
                          key={list.id}
                          className="col-span-2 rounded-xl border-2 border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/30 p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Trash2 size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                            <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                              Supprimer <span className="font-semibold">{list.name}</span> ?
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-8 px-3 rounded-md text-xs font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(list.id)}
                              className="h-8 px-3 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <motion.button
                        key={list.id}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleToggle(list.id)}
                        className="group relative text-left rounded-xl border-2 transition-all overflow-hidden"
                        style={{
                          backgroundColor: isSelected ? `${color}12` : 'rgb(var(--color-surface))',
                          borderColor: isSelected ? color : 'rgb(var(--color-border))',
                        }}
                      >
                        {/* Color band en haut */}
                        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

                        <div className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                              {list.name}
                            </p>
                            <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                              {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {/* Toggle indicator */}
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all"
                            style={{
                              backgroundColor: isSelected ? color : 'transparent',
                              border: isSelected ? 'none' : '2px solid rgb(var(--color-border))',
                            }}
                          >
                            <AnimatePresence>
                              {isSelected && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                  className="flex items-center justify-center"
                                >
                                  <Check size={13} className="text-white" strokeWidth={3} />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Actions hover : edit + delete */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setEditing({ id: list.id, name: list.name, color: list.color }); setConfirmDeleteId(null); setDraft(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setEditing({ id: list.id, name: list.name, color: list.color }); } }}
                            aria-label={`Modifier ${list.name}`}
                            className="w-7 h-7 rounded-md flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-blue-600 cursor-pointer"
                          >
                            <Pencil size={11} />
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(list.id); setEditing(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setConfirmDeleteId(list.id); } }}
                            aria-label={`Supprimer ${list.name}`}
                            className="w-7 h-7 rounded-md flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </span>
                        </div>
                      </motion.button>
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
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors"
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

// ════════════════════════════════════════════════════════════════════════
// Mobile : version ff032ad (iOS-style sheet avec brouillon inline,
// cycle couleur, mode édition Pencil). Inchangée.
// ════════════════════════════════════════════════════════════════════════

const MobileAddToList: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
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

  useEffect(() => {
    if (!isOpen) {
      setEditMode(false);
      setConfirmDeleteId(null);
      setDraftList(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (hasDraft) {
      requestAnimationFrame(() => draftInputRef.current?.focus());
    }
  }, [hasDraft]);

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

  const cycleListColor = (list: { id: string; name: string; color: string }) => {
    const currentHex = resolveColor(list.color);
    const currentIdx = COLOR_PALETTE.findIndex((c) => c.hex === currentHex);
    const nextKey = COLOR_PALETTE[(currentIdx + 1) % COLOR_PALETTE.length].key;
    updateListMutation.mutate({ id: list.id, updates: { name: list.name, color: nextKey } });
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title-mobile"
        >
          <motion.div
            ref={sheetRef}
            {...sheetDragProps}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] bg-[rgb(var(--color-surface))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
            </div>

            <div className="flex items-center justify-between px-4 pb-2 shrink-0">
              <p id="add-to-list-title-mobile" className="text-[13px] font-semibold uppercase tracking-wider text-gray-500">
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

                  if (editMode) {
                    return (
                      <div key={list.id} className="flex items-center gap-3 px-1 py-2.5">
                        <button
                          type="button"
                          onClick={() => cycleListColor(list)}
                          aria-label="Changer la couleur"
                          className="w-5 h-5 rounded-full shrink-0 transition-transform active:scale-90"
                          style={{ backgroundColor: color }}
                        />

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
                          className="flex-1 min-w-0 text-sm font-medium bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))]"
                          style={{ border: 'none' }}
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
                      style={{ border: 'none' }}
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

            <div className="px-5 pt-3 pb-5 border-t border-[rgb(var(--color-border))] shrink-0">
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

// ════════════════════════════════════════════════════════════════════════
// Dispatch desktop ↔ mobile selon viewport.
// ════════════════════════════════════════════════════════════════════════

const AddToListModal: React.FC<AddToListModalProps> = (props) => {
  const isMobile = useIsMobile();
  return isMobile ? <MobileAddToList {...props} /> : <DesktopAddToList {...props} />;
};

export default AddToListModal;
