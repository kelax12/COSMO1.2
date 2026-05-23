import React, { useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
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
  { key: 'blue', hex: '#3B82F6', label: 'Bleu' },
  { key: 'red', hex: '#EF4444', label: 'Rouge' },
  { key: 'green', hex: '#10B981', label: 'Vert' },
  { key: 'purple', hex: '#8B5CF6', label: 'Violet' },
  { key: 'orange', hex: '#F97316', label: 'Orange' },
  { key: 'yellow', hex: '#F59E0B', label: 'Jaune' },
  { key: 'pink', hex: '#EC4899', label: 'Rose' },
  { key: 'indigo', hex: '#6366F1', label: 'Indigo' },
];

const colorMap: Record<string, string> = Object.fromEntries(
  COLOR_PALETTE.map((c) => [c.key, c.hex])
);

const resolveColor = (color: string) => colorMap[color] || color;

const AddToListModal: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const dragControls = useDragControls();
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>('blue');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('blue');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreating(false);
      setNewName('');
      setNewColor('blue');
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
          return;
        }
        if (creating) {
          setCreating(false);
          return;
        }
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
          return;
        }
        onClose();
      }
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
    if (!list) return;
    if (list.type === 'smart') return;
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
    updateListMutation.mutate({
      id: editingId,
      updates: { name: trimmed, color: editColor },
    });
    setEditingId(null);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createListMutation.mutate({
      name: trimmed,
      color: newColor,
      type: 'manual',
    });
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-list-title"
        >
          <motion.div
            drag="y"
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
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl sm:shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-slate-950"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle (mobile) */}
            <div
              className="sm:hidden flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Header — editorial serif styling */}
            <div
              className="px-6 pt-6 sm:pt-8 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0 sm:cursor-default cursor-grab active:cursor-grabbing touch-none sm:touch-auto"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button,input,a,[contenteditable]')) return;
                dragControls.start(e);
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2
                    id="add-to-list-title"
                    className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 dark:text-white leading-tight"
                    style={{ fontFamily: '"Playfair Display", serif' }}
                  >
                    Listes
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {lists.length} {lists.length <= 1 ? 'liste' : 'listes'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                >
                  <X size={22} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Body — scrollable with staggered animation */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              {/* Create new list */}
              {!creating ? (
                <motion.button
                  onClick={() => {
                    setCreating(true);
                    setEditingId(null);
                  }}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                    }}
                    placeholder="Nom de la liste"
                    className="w-full bg-transparent text-lg font-semibold focus:outline-none"
                    style={{ color: 'rgb(var(--color-text-primary))' }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {COLOR_PALETTE.map((c) => (
                      <motion.button
                        key={c.key}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNewColor(c.key)}
                        aria-label={`Couleur ${c.label}`}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{
                          backgroundColor: c.hex,
                          outline:
                            newColor === c.key
                              ? `3px solid ${c.hex}`
                              : 'none',
                          outlineOffset: 2,
                          transform:
                            newColor === c.key
                              ? 'scale(1.2)'
                              : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => {
                        setCreating(false);
                        setNewName('');
                      }}
                      className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                      style={{
                        borderColor: 'rgb(var(--color-border))',
                        color: 'rgb(var(--color-text-primary))',
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Créer
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Existing lists with staggered animation */}
              {lists.length === 0 && !creating ? (
                <div className="text-center py-8">
                  <p
                    className="text-sm"
                    style={{ color: 'rgb(var(--color-text-muted))' }}
                  >
                    Aucune liste pour l'instant
                  </p>
                </div>
              ) : (
                lists.map((list, idx) => {
                  const isAlreadyInList = list.taskIds.includes(taskId);
                  const color = resolveColor(list.color);
                  const isEditing = editingId === list.id;
                  const isSmart = list.type === 'smart';
                  const isConfirmingDelete = confirmDeleteId === list.id;

                  return (
                    <motion.div
                      key={list.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      layout
                    >
                      {isEditing ? (
                        <motion.div
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                            }}
                            className="w-full bg-transparent text-lg font-semibold focus:outline-none mb-3"
                            style={{
                              color: 'rgb(var(--color-text-primary))',
                            }}
                          />
                          <div className="flex items-center gap-1.5 flex-wrap mb-3">
                            {COLOR_PALETTE.map((c) => (
                              <motion.button
                                key={c.key}
                                whileHover={{ scale: 1.15 }}
                                onClick={() => setEditColor(c.key)}
                                className="w-7 h-7 rounded-full transition-all"
                                style={{
                                  backgroundColor: c.hex,
                                  outline:
                                    editColor === c.key
                                      ? `3px solid ${c.hex}`
                                      : 'none',
                                  outlineOffset: 2,
                                }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                              style={{
                                borderColor: 'rgb(var(--color-border))',
                                color: 'rgb(var(--color-text-primary))',
                              }}
                            >
                              Annuler
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editName.trim()}
                              className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
                            >
                              Enregistrer
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleToggleTask(list.id)}
                          className="group relative rounded-xl border-2 p-4 cursor-pointer transition-all overflow-hidden"
                          style={{
                            backgroundColor: isAlreadyInList
                              ? `${color}10`
                              : 'rgb(var(--color-surface))',
                            borderColor: isAlreadyInList
                              ? color
                              : 'rgb(var(--color-border))',
                          }}
                        >
                          {/* Hover gradient background */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity"
                            style={{
                              background: `linear-gradient(135deg, ${color} 0%, ${color}00 100%)`,
                            }}
                          />

                          <div className="relative flex items-center gap-4">
                            {/* Color bar */}
                            <div
                              className="w-1 h-12 rounded-full shrink-0 transition-all"
                              style={{
                                backgroundColor: color,
                                transform: isAlreadyInList
                                  ? 'scaleY(1.2)'
                                  : 'scaleY(1)',
                              }}
                            />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p
                                  className="font-semibold text-sm sm:text-base truncate"
                                  style={{
                                    color: 'rgb(var(--color-text-primary))',
                                  }}
                                >
                                  {list.name}
                                </p>
                                {isSmart && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium shrink-0"
                                    style={{
                                      backgroundColor: `${color}20`,
                                      color: color,
                                    }}
                                  >
                                    <Sparkles size={9} />
                                    Auto
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-xs mt-1"
                                style={{
                                  color: 'rgb(var(--color-text-muted))',
                                }}
                              >
                                {list.taskIds.length}{' '}
                                {list.taskIds.length === 1
                                  ? 'tâche'
                                  : 'tâches'}
                              </p>
                            </div>

                            {/* Actions */}
                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                  className="min-w-9 h-9 px-2 rounded-lg text-xs font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                                  style={{
                                    borderColor: 'rgb(var(--color-border))',
                                    color: 'rgb(var(--color-text-primary))',
                                  }}
                                >
                                  Non
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmDelete(list.id);
                                  }}
                                  className="min-w-9 h-9 px-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                                >
                                  Oui
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-0.5 shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                {!isSmart && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(list.id);
                                    }}
                                    aria-label={`Modifier ${list.name}`}
                                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    style={{
                                      color: 'rgb(var(--color-text-muted))',
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </motion.button>
                                )}
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(list.id);
                                  }}
                                  aria-label={`Supprimer ${list.name}`}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                  style={{
                                    color: 'rgb(var(--color-text-muted))',
                                  }}
                                >
                                  <Trash2 size={15} />
                                </motion.button>
                              </div>
                            )}

                            {/* Checkmark indicator */}
                            {isAlreadyInList && !isSmart && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: color }}
                              >
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  strokeWidth="3"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 pt-4 pb-6 border-t shrink-0"
              style={{ borderColor: 'rgb(var(--color-border))' }}
            >
              <motion.button
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

export default AddToListModal;
