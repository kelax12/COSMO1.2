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
// Desktop : design éditorial (commit 2c5b5ca) — titre Playfair Display,
// cards avec barre colorée + hover gradient, animations whileHover/Tap.
// Modal centré, pas de drag/swipe (desktop uniquement).
// ════════════════════════════════════════════════════════════════════════

const DesktopAddToList: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const { data: lists = [] } = useLists();
  const addTaskToListMutation      = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation         = useCreateList();
  const updateListMutation         = useUpdateList();
  const deleteListMutation         = useDeleteList();

  const [creating, setCreating]               = useState(false);
  const [newName, setNewName]                 = useState('');
  const [newColor, setNewColor]               = useState('blue');
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editName, setEditName]               = useState('');
  const [editColor, setEditColor]             = useState('blue');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* Reset on close */
  useEffect(() => {
    if (!isOpen) {
      setCreating(false);
      setNewName('');
      setNewColor('blue');
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  /* ESC + body lock */
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

  const handleToggleTask = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list || list.type === 'smart') return;
    if (list.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId });
    } else {
      addTaskToListMutation.mutate({ taskId, listId });
    }
  };

  const handleStartEdit = (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;
    setEditingId(listId);
    setEditName(list.name);
    setEditColor(list.color);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    updateListMutation.mutate({ id: editingId, updates: { name: trimmed, color: editColor } });
    setEditingId(null);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createListMutation.mutate({ name: trimmed, color: newColor, type: 'manual' });
    setNewName('');
    setNewColor('blue');
    setCreating(false);
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
          transition={{ duration: 0.2 }}
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
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] bg-white dark:bg-slate-950"
          >
            {/* ── Header ── */}
            <div className="px-6 pt-8 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2
                    id="add-to-list-title"
                    className="text-4xl font-bold text-slate-900 dark:text-white leading-tight"
                    style={{ fontFamily: '"Playfair Display", serif' }}
                  >
                    Listes
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {lists.length} {lists.length <= 1 ? 'liste' : 'listes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                >
                  <X size={22} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div data-scroll-area className="flex-1 overflow-y-auto px-6 py-6 space-y-3">

              {/* Create new list — button or form */}
              {!creating ? (
                <motion.button
                  type="button"
                  onClick={() => { setCreating(true); setEditingId(null); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full group relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 py-4 px-4 transition-all hover:border-blue-400 dark:hover:border-blue-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-center gap-2">
                    <Plus size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Nouvelle liste</span>
                  </div>
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 border-2"
                  style={{
                    borderColor: resolveColor(newColor),
                    backgroundColor: `${resolveColor(newColor)}0D`,
                  }}
                >
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                    placeholder="Nom de la liste"
                    className="w-full bg-transparent text-lg font-semibold focus:outline-none"
                    style={{ color: 'rgb(var(--color-text-primary))' }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {COLOR_PALETTE.map((c) => (
                      <motion.button
                        key={c.key}
                        type="button"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNewColor(c.key)}
                        aria-label={`Couleur ${c.label}`}
                        aria-pressed={newColor === c.key}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{
                          backgroundColor: c.hex,
                          outline: newColor === c.key ? `3px solid ${c.hex}` : 'none',
                          outlineOffset: 2,
                          transform: newColor === c.key ? 'scale(1.2)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => { setCreating(false); setNewName(''); }}
                      className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Créer
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Empty state */}
              {lists.length === 0 && !creating && (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400 dark:text-slate-500">Aucune liste pour l'instant</p>
                </div>
              )}

              {/* List items */}
              {lists.map((list, idx) => {
                const isAlreadyInList = list.taskIds.includes(taskId);
                const color           = resolveColor(list.color);
                const isEditing       = editingId === list.id;
                const isSmart         = list.type === 'smart';
                const isConfirming    = confirmDeleteId === list.id;

                if (isEditing) {
                  return (
                    <motion.div
                      key={list.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-xl border-2 p-4"
                      style={{
                        borderColor: resolveColor(editColor),
                        backgroundColor: `${resolveColor(editColor)}0D`,
                      }}
                    >
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-full bg-transparent text-lg font-semibold focus:outline-none mb-3"
                        style={{ color: 'rgb(var(--color-text-primary))' }}
                      />
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {COLOR_PALETTE.map((c) => (
                          <motion.button
                            key={c.key}
                            type="button"
                            whileHover={{ scale: 1.15 }}
                            onClick={() => setEditColor(c.key)}
                            aria-label={`Couleur ${c.label}`}
                            aria-pressed={editColor === c.key}
                            className="w-7 h-7 rounded-full transition-all"
                            style={{
                              backgroundColor: c.hex,
                              outline: editColor === c.key ? `3px solid ${c.hex}` : 'none',
                              outlineOffset: 2,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                          style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!editName.trim()}
                          className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={list.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    layout
                  >
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleToggleTask(list.id)}
                      className="group relative rounded-xl border-2 p-4 cursor-pointer transition-all overflow-hidden"
                      style={{
                        backgroundColor: isAlreadyInList ? `${color}10` : 'rgb(var(--color-surface))',
                        borderColor: isAlreadyInList ? color : 'rgb(var(--color-border))',
                      }}
                    >
                      {/* Hover gradient */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity"
                        style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}00 100%)` }}
                      />

                      <div className="relative flex items-center gap-4">
                        {/* Color bar */}
                        <div
                          className="w-1 h-12 rounded-full shrink-0 transition-all"
                          style={{
                            backgroundColor: color,
                            transform: isAlreadyInList ? 'scaleY(1.2)' : 'scaleY(1)',
                          }}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="font-semibold text-base truncate"
                              style={{ color: 'rgb(var(--color-text-primary))' }}
                            >
                              {list.name}
                            </p>
                            {isSmart && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                                style={{ backgroundColor: `${color}20`, color }}
                              >
                                <Sparkles size={9} aria-hidden="true" />
                                Auto
                              </span>
                            )}
                          </div>
                          <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                            {list.taskIds.length} {list.taskIds.length === 1 ? 'tâche' : 'tâches'}
                          </p>
                        </div>

                        {/* Actions */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="min-w-9 h-9 px-2 rounded-lg text-xs font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))' }}
                            >
                              Non
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleConfirmDelete(list.id); }}
                              className="min-w-9 h-9 px-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                              Oui
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isSmart && (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => { e.stopPropagation(); handleStartEdit(list.id); }}
                                aria-label={`Modifier ${list.name}`}
                                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                style={{ color: 'rgb(var(--color-text-muted))' }}
                              >
                                <Pencil size={15} />
                              </motion.button>
                            )}
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(list.id); }}
                              aria-label={`Supprimer ${list.name}`}
                              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              style={{ color: 'rgb(var(--color-text-muted))' }}
                            >
                              <Trash2 size={15} />
                            </motion.button>
                          </div>
                        )}

                        {/* Checkmark */}
                        {isAlreadyInList && !isSmart && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            <Check size={11} className="text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Footer ── */}
            <div className="px-6 pt-4 pb-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="w-full min-h-12 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
              >
                Terminer
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ════════════════════════════════════════════════════════════════════════
// Mobile : version iOS-style sheet avec brouillon inline,
// cycle couleur, mode édition Pencil. Inchangée.
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
