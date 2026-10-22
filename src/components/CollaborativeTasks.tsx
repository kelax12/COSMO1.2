import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Bookmark, Calendar, ListPlus, Trash2 } from 'lucide-react';
import TaskRow from './TaskRow';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AddToListModal from './AddToListModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useDeleteTask, useToggleTaskBookmark, useToggleTaskComplete, Task } from '@/modules/tasks';
import { useCreateEvent, CreateEventInput } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════

import { useAuth } from '@/modules/auth/AuthContext';
// Fraîcheur d'une tâche partagée (#40) — délégué à `Intl.RelativeTimeFormat`
// via `@/i18n/format`, qui gère toutes les langues sans table à maintenir.
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { selectCollaborativeTasks } from './collaborative-tasks.helpers';

const CollaborativeTasks = ({ compact = false }: { compact?: boolean }) => {
  const { t, tp } = useT('dashboard');
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading } = useTasks();
  const deleteMutation         = useDeleteTask();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();
  const createEventMutation    = useCreateEvent();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════

  const { user } = useAuth();

  // shared_tasks = source de vérité du partage (colonne `tasks.collaborators`
  // supprimée — migration 028). Map taskId -> friendIds pour compteurs/avatars.


  // Action modals
  const [taskModalTask, setTaskModalTask]               = useState<Task | null>(null);
  const [taskToEventModal, setTaskToEventModal]         = useState<Task | null>(null);
  const [addToListTask, setAddToListTask]               = useState<string | null>(null);
  const [collaboratorModalTaskId, setCollaboratorModalTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete]                 = useState<string | null>(null);

  const handleCreateEventFromTask = (eventData: CreateEventInput) => {
    if (taskToEventModal) {
      createEventMutation.mutate({ ...eventData, taskId: taskToEventModal.id });
    }
    setTaskToEventModal(null);
  };

  const confirmDelete = () => {
    if (!taskToDelete) return;
    deleteMutation.mutate(taskToDelete, { onSuccess: () => setTaskToDelete(null) });
  };

  // Exclude tasks assigned by others that haven't been accepted yet (still pending in SocialRequests)
  const collaborativeTasks = selectCollaborativeTasks(tasks, user?.name);


  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Cette surface n'en portait aucune.
  //
  // Pose AVANT l'etat de chargement ci-dessous, qui sort du composant : un
  // hook place apres lui ne serait pas appele a chaque rendu.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: Boolean(taskToDelete),
    onClose: () => setTaskToDelete(null),
    label: t('todayTasks.deleteDialog.title'),
    role: 'alertdialog',
  });

  if (isLoading) {
    return (
      <div className="card-plain-mobile p-gutter md:p-8 rounded-2xl animate-pulse">
        <div className="h-8 w-48 bg-[rgb(var(--color-border))] rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[rgb(var(--color-border))] rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('sections.collaborativeTasks')}</h2>
                <p className="text-[rgb(var(--color-text-secondary))] text-sm">{tp('collaborative.shared', collaborativeTasks.length)}</p>
              </div>
            </div>
        </div>

        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {collaborativeTasks.map(task => (
            <TaskRow
              key={task.id}
              name={task.name}
              completeLabel={t('todayTasks.markDone', { name: task.name })}
              onComplete={() => toggleCompleteMutation.mutate(task.id)}
              onOpen={() => setTaskModalTask(task)}
              compact={compact}
              actions={[
                { key: 'bookmark', label: t('todayTasks.bookmark'), icon: Bookmark, active: !!task.bookmarked, run: () => toggleBookmarkMutation.mutate(task.id) },
                { key: 'event', label: t('collaborative.addToAgenda'), icon: Calendar, run: () => setTaskToEventModal(task) },
                { key: 'list', label: t('collaborative.addToList'), icon: ListPlus, run: () => setAddToListTask(task.id) },
                { key: 'collab', label: t('todayTasks.collaboratorsTitle'), icon: UserPlus, run: () => setCollaboratorModalTaskId(task.id) },
                { key: 'delete', label: t('collab.removeShare'), icon: Trash2, danger: true, run: () => setTaskToDelete(task.id) },
              ]}
            />
          ))}
        </ul>
        <div>
          {collaborativeTasks.length === 0 && (
            <div className="text-center py-8 text-[rgb(var(--color-text-secondary))]">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-body sm:text-base">{t('collaborative.emptyTitle')}</p>
              <p className="text-label sm:text-sm">{t('collaborative.emptyDescription')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action modals */}
      {taskModalTask && (
        <TaskModal task={taskModalTask} isOpen={!!taskModalTask} onClose={() => setTaskModalTask(null)} />
      )}
      {taskToEventModal && (
        <EventModal
          mode="convert"
          isOpen={true}
          onClose={() => setTaskToEventModal(null)}
          task={taskToEventModal}
          onConvert={handleCreateEventFromTask}
        />
      )}
      {addToListTask && (
        <AddToListModal isOpen={true} onClose={() => setAddToListTask(null)} taskId={addToListTask} />
      )}
      {/* Collaborateurs — réutilise la vue Collaborateurs de TaskModal (étape 2). */}
      {collaboratorModalTaskId && (() => {
        const collabTask = tasks.find(t => t.id === collaboratorModalTaskId);
        return collabTask ? (
          <TaskModal task={collabTask} isOpen onClose={() => setCollaboratorModalTaskId(null)} showCollaborators />
        ) : null;
      })()}
      {taskToDelete && (
        <div ref={modalA11yRef} {...modalA11yProps} className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
          >
            <div className="p-6">
              {/* Icône retirée sur mobile (demande utilisateur), même choix
                  que DeleteTaskConfirm / ConfirmDeleteSheet / ConfirmDiscardDialog :
                  le titre porte déjà toute l'information. Desktop inchangé. */}
              <div className="hidden sm:flex w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center mb-4">
                <Trash2 className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('todayTasks.deleteDialog.title')}</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                {t('todayTasks.deleteDialog.body')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  {t('todayTasks.deleteDialog.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                >
                  {t('todayTasks.deleteDialog.confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default CollaborativeTasks;
