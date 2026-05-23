import React, { useEffect, useState } from 'react';
import { X, Check, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
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

const COLOR_PALETTE: { key: string; hex: string }[] = [
  { key: 'blue', hex: '#3B82F6' },
  { key: 'red', hex: '#EF4444' },
  { key: 'green', hex: '#10B981' },
  { key: 'purple', hex: '#8B5CF6' },
  { key: 'orange', hex: '#F97316' },
  { key: 'yellow', hex: '#F59E0B' },
  { key: 'pink', hex: '#EC4899' },
  { key: 'indigo', hex: '#6366F1' },
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

  // States for create / edit / delete flows
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>('blue');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('blue');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Reset transient states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreating(false);
      setNewName('');
      setNewColor('blue');
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  // ESC to close + lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); return; }
        if (creating) { setCreating(false); return; }
        if (confirmDeleteId) { setConfirmDeleteId(null); return; }
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
    if (list.type === 'smart') return; // smart lists are computed, not editable membership
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-md"
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
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[80vh]"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle (mobile) */}
            <div
              className="sm:hidden flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
            </div>

            {/* Header */}
            <div
              className="flex justify-between items-center px-5 py-3 sm:py-4 border-b shrink-0 sm:cursor-default cursor-grab active:cursor-grabbing touch-none sm:touch-auto"
              style={{ borderColor: 'rgb(var(--color-border))' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button,input,a,[contenteditable]')) return;
                dragControls.start(e);
              }}
            >
              <div className="flex flex-col">
                <h2
                  id="add-to-list-title"
                  className="text-lg sm:text-xl font-bold leading-tight"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  Ajouter à une liste
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  {lists.length} {lists.length <= 1 ? 'liste disponible' : 'listes disponibles'}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Create new list — collapsed button or expanded form */}
              {!creating ? (
                <button
                  onClick={() => { setCreating(true); setEditingId(null); }}
                  className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border-2 border-dashed transition-all min-h-[56px] text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/20 monochrome:hover:bg-neutral-100 dark:monochrome:hover:bg-neutral-900"
                  style={{ borderColor: 'rgb(var(--color-border))' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-950/40 monochrome:bg-neutral-200 dark:monochrome:bg-neutral-800">
                    <Plus size={18} className="text-blue-600 dark:text-blue-400 monochrome:text-black dark:monochrome:text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm sm:text-base text-blue-600 dark:text-blue-400 monochrome:text-black dark:monochrome:text-white">
                      Nouvelle liste
                    </p>
                  </div>
                </button>
              ) : (
                <div
                  className="rounded-xl border-2 p-3 space-y-3"
                  style={{
                    borderColor: resolveColor(newColor),
                    backgroundColor: `${resolveColor(newColor)}0D`,
                  }}
                >
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                    placeholder="Nom de la liste"
                    className="w-full bg-transparent text-sm sm:text-base font-semibold focus:outline-none placeholder:font-normal"
                    style={{ color: 'rgb(var(--color-text-primary))' }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setNewColor(c.key)}
                        aria-label={`Couleur ${c.key}`}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{
                          backgroundColor: c.hex,
                          outline: newColor === c.key ? `2px solid ${c.hex}` : 'none',
                          outlineOffset: 2,
                          transform: newColor === c.key ? 'scale(1.1)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setCreating(false); setNewName(''); }}
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
                      className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed monochrome:bg-black monochrome:text-white transition-colors"
                    >
                      Créer
                    </button>
                  </div>
                </div>
              )}

              {/* Existing lists */}
              {lists.length === 0 && !creating ? (
                <div className="py-8 text-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  <p className="text-sm">Aucune liste pour l'instant</p>
                </div>
              ) : (
                lists.map((list) => {
                  const isAlreadyInList = list.taskIds.includes(taskId);
                  const color = resolveColor(list.color);
                  const isEditing = editingId === list.id;
                  const isSmart = list.type === 'smart';
                  const isConfirmingDelete = confirmDeleteId === list.id;

                  if (isEditing) {
                    return (
                      <div
                        key={list.id}
                        className="rounded-xl border-2 p-3 space-y-3"
                        style={{
                          borderColor: resolveColor(editColor),
                          backgroundColor: `${resolveColor(editColor)}0D`,
                        }}
                      >
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                          className="w-full bg-transparent text-sm sm:text-base font-semibold focus:outline-none"
                          style={{ color: 'rgb(var(--color-text-primary))' }}
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c.key}
                              onClick={() => setEditColor(c.key)}
                              aria-label={`Couleur ${c.key}`}
                              className="w-7 h-7 rounded-full transition-all"
                              style={{
                                backgroundColor: c.hex,
                                outline: editColor === c.key ? `2px solid ${c.hex}` : 'none',
                                outlineOffset: 2,
                                transform: editColor === c.key ? 'scale(1.1)' : 'scale(1)',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
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
                            className="flex-1 min-h-10 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed monochrome:bg-black monochrome:text-white transition-colors"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={list.id}
                      layout
                      whileTap={{ scale: 0.99 }}
                      className="group w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border-2 transition-all min-h-[60px]"
                      style={{
                        backgroundColor: isAlreadyInList ? `${color}15` : 'rgb(var(--color-surface))',
                        borderColor: isAlreadyInList ? color : 'rgb(var(--color-border))',
                      }}
                    >
                      <button
                        onClick={() => handleToggleTask(list.id)}
                        disabled={isSmart}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                      >
                        <div
                          className="w-1.5 h-10 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p
                              className="font-semibold text-sm sm:text-base truncate"
                              style={{ color: 'rgb(var(--color-text-primary))' }}
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
                          <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
                            {list.taskIds.length} {list.taskIds.length === 1 ? 'tâche' : 'tâches'}
                          </p>
                        </div>
                        {isAlreadyInList && !isSmart && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            <Check size={16} className="text-white" />
                          </div>
                        )}
                      </button>

                      {/* Actions edit / delete */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-w-9 h-9 px-2 rounded-lg text-xs font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                            style={{
                              borderColor: 'rgb(var(--color-border))',
                              color: 'rgb(var(--color-text-primary))',
                            }}
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(list.id)}
                            className="min-w-9 h-9 px-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-black transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {!isSmart && (
                            <button
                              onClick={() => handleStartEdit(list.id)}
                              aria-label={`Modifier ${list.name}`}
                              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              style={{ color: 'rgb(var(--color-text-muted))' }}
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDeleteId(list.id)}
                            aria-label={`Supprimer ${list.name}`}
                            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
                            style={{ color: 'rgb(var(--color-text-muted))' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 pt-3 pb-4 border-t shrink-0"
              style={{ borderColor: 'rgb(var(--color-border))' }}
            >
              <button
                onClick={onClose}
                className="w-full min-h-11 px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 monochrome:bg-white monochrome:text-black transition-colors"
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
