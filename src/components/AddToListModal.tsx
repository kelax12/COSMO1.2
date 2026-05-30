import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Sparkles } from 'lucide-react';
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
// Desktop : design issu du commit 3b54070 (Fix swipe-to-close, 2026-05-25).
// InlineForm pour création/édition, bouton « Nouvelle liste », icônes
// Pencil/Trash révélées au hover. NE PAS modifier sans accord utilisateur.
// ════════════════════════════════════════════════════════════════════════

const ColorRow: React.FC<{
  selected: string;
  onChange: (key: string) => void;
}> = ({ selected, onChange }) => (
  <div className="flex items-center gap-2 flex-wrap">
    {COLOR_PALETTE.map((c) => (
      <button
        key={c.key}
        type="button"
        onClick={() => onChange(c.key)}
        aria-label={`Couleur ${c.label}`}
        className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          backgroundColor: c.hex,
          transform: selected === c.key ? 'scale(1.25)' : 'scale(1)',
          outline: selected === c.key ? `2px solid ${c.hex}` : 'none',
          outlineOffset: 2,
        }}
      />
    ))}
  </div>
);

const InlineForm: React.FC<{
  initialName?: string;
  initialColor?: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  saveLabel?: string;
}> = ({ initialName = '', initialColor = 'blue', onSave, onCancel, saveLabel = 'Créer' }) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 space-y-3"
    >
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim(), color);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Nom de la liste"
        className="w-full h-11 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-slate-50 dark:bg-slate-800/50 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] transition-all"
      />

      <ColorRow selected={color} onChange={setColor} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-9 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => { if (name.trim()) onSave(name.trim(), color); }}
          disabled={!name.trim()}
          className="flex-1 min-h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </motion.div>
  );
};

const DesktopAddToList: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const { data: lists = [] } = useLists();
  const addTaskToListMutation    = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();

  const [creating, setCreating]           = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
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
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[80vh] bg-[rgb(var(--color-surface))]"
          >
            <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="add-to-list-title" className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
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

            <div data-scroll-area className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
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

              {lists.length === 0 && !creating && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Aucune liste pour l'instant
                  </p>
                </div>
              )}

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
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                            {list.name}
                          </span>
                          {isSmart && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              <Sparkles size={8} />
                              Auto
                            </span>
                          )}
                          <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">
                            {list.taskIds.length} tâche{list.taskIds.length !== 1 ? 's' : ''}
                          </span>
                        </div>

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

            <div className="px-6 pt-3 pb-5 border-t border-[rgb(var(--color-border))] shrink-0">
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
