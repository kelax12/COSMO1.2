import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList, useRemoveTaskFromList } from '@/modules/lists';

type AddToListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

const AddToListModal: React.FC<AddToListModalProps> = ({ isOpen, onClose, taskId }) => {
  const dragControls = useDragControls();
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();

  // ESC to close + lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  const handleAddToList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (list?.taskIds.includes(taskId)) {
      removeTaskFromListMutation.mutate({ taskId, listId });
    } else {
      addTaskToListMutation.mutate({ taskId, listId });
    }
  };

  const colorMap: Record<string, string> = {
    blue: '#3B82F6',
    red: '#EF4444',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#F97316',
    yellow: '#F59E0B',
    pink: '#EC4899',
    indigo: '#6366F1',
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
            {/* Drag handle (mobile only) — déclenche le swipe-to-dismiss */}
            <div
              className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
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
              <h2
                id="add-to-list-title"
                className="text-lg sm:text-xl font-bold"
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                Ajouter à une liste
              </h2>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Body — scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lists.length === 0 ? (
                <div className="py-8 text-center" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  <p className="text-sm">Aucune liste disponible</p>
                </div>
              ) : (
                lists.map(list => {
                  const isAlreadyInList = list.taskIds.includes(taskId);
                  const color = colorMap[list.color] || list.color;
                  return (
                    <motion.button
                      key={list.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToList(list.id)}
                      className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all min-h-[60px] text-left"
                      style={{
                        backgroundColor: isAlreadyInList ? `${color}15` : 'rgb(var(--color-surface))',
                        borderColor: isAlreadyInList ? color : 'rgb(var(--color-border))',
                      }}
                    >
                      <div
                        className="w-1.5 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-base truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                          {list.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
                          {list.taskIds.length} {list.taskIds.length === 1 ? 'tâche' : 'tâches'}
                        </p>
                      </div>
                      {isAlreadyInList && (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          <Check size={16} className="text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Footer — sticky */}
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
