import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Sparkles } from 'lucide-react';
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

/* ─── Colour picker row ─────────────────────────────────────────────────── */
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

/* ─── Inline form (create / edit) ────────────────────────────────────────── */
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
      {/* Name input */}
      <div className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] bg-slate-50 dark:bg-slate-800/50 px-3 h-11 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: resolveColor(color) }}
        />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim(), color);
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Nom de la liste"
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))]"
        />
      </div>

      {/* Color row */}
      <ColorRow selected={color} onChange={setColor} />

      {/* Buttons */}
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

/* ─── Main component ─────────────────────────────────────────────────────── */
const AddToListModal: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const dragControls = useDragControls();
  const { data: lists = [] } = useLists();
  const addTaskToListMutation    = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();

  const [creating, setCreating]           = useState(false);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* Reset on close */
  useEffect(() => {
    if (!isOpen) {
      setCreating(false);
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

  /* Handlers */
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
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
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[80vh] bg-[rgb(var(--color-surface))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* ── Drag handle (mobile only) ── */}
            <div
              className="sm:hidden flex justify-center pt-3 pb-1 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* ── Header ── */}
            <div
              className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[rgb(var(--color-border))] shrink-0"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button,input,a,[contenteditable]')) return;
                dragControls.start(e);
              }}
            >
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

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-1">

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

              {/* Separator */}
              {lists.length > 0 && (
                <div className="border-t border-[rgb(var(--color-border))] my-2" />
              )}

              {/* Empty state */}
              {lists.length === 0 && !creating && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[rgb(var(--color-text-muted))]">
                    Aucune liste pour l'instant
                  </p>
                </div>
              )}

              {/* List items */}
              {lists.map((list) => {
                const isSelected = list.taskIds.includes(taskId);
                const color      = resolveColor(list.color);
                const isSmart    = list.type === 'smart';
                const isEditing  = editingId === list.id;
                const isDeleting = confirmDeleteId === list.id;

                if (isEditing) {
                  return (
                    <div key={list.id}>
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
                  <div key={list.id} className="group flex items-center gap-3 px-3 py-3.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => handleToggle(list.id)}>
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
                          <Sparkles size={8} />
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
                          {/* Check (selected) */}
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

                          {/* Edit */}
                          {!isSmart && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingId(list.id); setConfirmDeleteId(null); setCreating(false); }}
                              aria-label={`Modifier ${list.name}`}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Pencil size={13} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(list.id); }}
                            aria-label={`Supprimer ${list.name}`}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
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

            {/* ── Footer ── */}
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
