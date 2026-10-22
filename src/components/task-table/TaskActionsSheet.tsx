// ═══════════════════════════════════════════════════════════════════
// task-table/TaskActionsSheet — feuille d'actions mobile d'une tâche,
// design Spotify (en-tête vignette + titre/sous-titre, puis liste
// verticale icône + libellé pleine largeur).
//
// Remplace l'ancienne « rangée d'actions » horizontale (icônes seules,
// sans texte) qui s'ouvrait EN PLACE sous la carte. Un `createPortal`
// vers `document.body` évite que le `transform` du swipe de la carte
// (posé par framer-motion sur un ancêtre) ne reprojette une feuille
// `fixed` à l'intérieur de la carte au lieu du viewport.
//
// C-53 : surface modale maison → `useModalA11y` (piège de focus, Échap,
// restitution au déclencheur), pas un `onKeyDown` réinventé à la main.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Bookmark, UserPlus, Calendar, ListPlus, Trash2, CheckCircle2 } from 'lucide-react';
import { useSheetMotion, useSheetDrag } from '@/components/mobile/mobile-motion';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useT } from '@/i18n/useT';
import { formatDate } from './helpers';

export interface TaskActionsSheetTask {
  id: string;
  name: string;
  completed: boolean;
  bookmarked: boolean;
  deadline?: string;
}

interface TaskActionsSheetProps {
  open: boolean;
  task: TaskActionsSheetTask | null;
  categoryName?: string;
  categoryColor: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onOpenCollaborator: (id: string) => void;
  onScheduleTask: (id: string) => void;
  onAddToList: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const ROW_ICON = { size: 20, strokeWidth: 1.75 } as const;

const TaskActionsSheet: React.FC<TaskActionsSheetProps> = ({
  open,
  task,
  categoryName,
  categoryColor,
  onClose,
  onEdit,
  onToggleBookmark,
  onOpenCollaborator,
  onScheduleTask,
  onAddToList,
  onDeleteTask,
}) => {
  const { t } = useT('tasks');
  const sheetMotion = useSheetMotion();
  const sheetDrag = useSheetDrag(onClose);
  const isOpen = open && !!task;
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose,
    label: task ? t('card.actionsFor', { name: task.name }) : undefined,
  });

  if (typeof document === 'undefined') return null;

  const run = (fn: (id: string) => void) => {
    if (!task) return;
    fn(task.id);
    onClose();
  };

  const content = (
    <AnimatePresence>
      {isOpen && task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            {...dialogProps}
            {...sheetMotion}
            {...sheetDrag}
            onClick={(e) => e.stopPropagation()}
            className="w-full flex flex-col rounded-t-sheet"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Poignée de glissement */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-9 h-[4px] rounded-full" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
            </div>

            {/* En-tête — vignette + titre + sous-titre (calque Spotify) */}
            <div className="flex items-center gap-3 px-5 pb-4">
              <div
                className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: categoryColor }}
              >
                <CheckCircle2
                  size={22}
                  className={task.completed ? 'text-white' : 'text-white/70'}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-body font-semibold leading-snug line-clamp-2"
                  style={{ color: 'rgb(var(--color-text-primary))' }}
                >
                  {task.name}
                </p>
                <p className="text-label mt-0.5 truncate" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  {categoryName || t('card.noCategoryShort')}
                  {task.deadline ? ` · ${formatDate(task.deadline)}` : ''}
                </p>
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />

            {/* Actions — icône nue + libellé, pleine largeur, sans grille */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => run(onEdit)}
                className="w-full flex items-center gap-4 px-5 min-h-[52px] text-left active:opacity-50 transition-opacity"
              >
                <Pencil {...ROW_ICON} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                <span className="text-body" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {t('card.edit')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => run(onToggleBookmark)}
                className="w-full flex items-center gap-4 px-5 min-h-[52px] text-left active:opacity-50 transition-opacity"
              >
                <Bookmark
                  {...ROW_ICON}
                  aria-hidden="true"
                  fill={task.bookmarked ? 'currentColor' : 'none'}
                  style={{ color: task.bookmarked ? '#f59e0b' : 'rgb(var(--color-text-secondary))', flexShrink: 0 }}
                />
                <span className="text-body" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {task.bookmarked ? t('card.unfavorite') : t('card.favorite')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => run(onOpenCollaborator)}
                className="w-full flex items-center gap-4 px-5 min-h-[52px] text-left active:opacity-50 transition-opacity"
              >
                <UserPlus {...ROW_ICON} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                <span className="text-body" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {t('card.addCollaborator')}
                </span>
              </button>

              {!task.completed && (
                <button
                  type="button"
                  onClick={() => run(onScheduleTask)}
                  className="w-full flex items-center gap-4 px-5 min-h-[52px] text-left active:opacity-50 transition-opacity"
                >
                  <Calendar {...ROW_ICON} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                  <span className="text-body" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {t('card.schedule')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => run(onAddToList)}
                className="w-full flex items-center gap-4 px-5 min-h-[52px] text-left active:opacity-50 transition-opacity"
              >
                <ListPlus {...ROW_ICON} aria-hidden="true" style={{ color: 'rgb(var(--color-text-secondary))', flexShrink: 0 }} />
                <span className="text-body" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {t('card.addToList')}
                </span>
              </button>
            </div>

            {/* Supprimer — groupe séparé, rouge (même traitement que ListActionsSheet) */}
            <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
            <div className="mx-4 my-3 rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(239,68,68,0.06)' }}>
              <button
                type="button"
                onClick={() => run(onDeleteTask)}
                className="w-full flex items-center gap-4 px-4 min-h-[50px] text-left active:opacity-50 transition-opacity"
              >
                <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" className="text-red-500 shrink-0" />
                <span className="text-body text-red-500">{t('card.delete')}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};

export default TaskActionsSheet;
