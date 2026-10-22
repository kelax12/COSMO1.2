import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import { CheckSquare, Bookmark, Calendar, ListPlus, UserPlus, Trash2 } from 'lucide-react';
import TaskRow from './TaskRow';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AddToListModal from './AddToListModal';
import EmptyState from './EmptyState';

import { useTasks, useToggleTaskComplete, useToggleTaskBookmark, useDeleteTask, useRestoreTask, Task } from '@/modules/tasks';
import { useCreateEvent, CreateEventInput } from '@/modules/events';
import { useT } from '@/i18n/useT';
import { isDueToday } from '@/lib/deadline';
import { useModalA11y } from '@/hooks/use-modal-a11y';

const TodayTasks = ({ compact = false }: { compact?: boolean }) => {
  const { t, tp } = useT('dashboard');

  // Modals
  const [selectedTask, setSelectedTask]             = useState<Task | null>(null);
  const [taskToEventModal, setTaskToEventModal]     = useState<Task | null>(null);
  const [addToListTask, setAddToListTask]           = useState<string | null>(null);
  const [collaboratorTaskId, setCollaboratorTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete]             = useState<string | null>(null);

  const navigate = useNavigate();
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();
  const toggleCompleteMutation  = useToggleTaskComplete();
  const toggleBookmarkMutation  = useToggleTaskBookmark();
  const deleteMutation          = useDeleteTask();
  // « Annuler » uniquement : rend la tache sous SON identifiant (R-08).
  const restoreMutation         = useRestoreTask();
  const createEventMutation     = useCreateEvent();

  const todayTasks = useMemo(() => {
    return tasks
      .filter(task => !task.completed)
      .filter(task => {
        // `toDateString()` compare deux jours en heure MACHINE, sans tenir
        // compte du fuseau réglé ni du fait que l'échéance est un jour (R-01).
        const dueToday = isDueToday(task.deadline);
        // Priorité facultative : 0 = non définie, ne compte pas comme « haute ».
        return dueToday || (task.priority > 0 && task.priority <= 2);
      })
      .sort((a, b) => {
        if (a.bookmarked && !b.bookmarked) return -1;
        if (!a.bookmarked && b.bookmarked) return 1;
        return a.priority - b.priority;
      })
      .slice(0, 5);
    // `isDueToday()` lit l'heure courante à chaque render : la granularité est
    // le jour, donc mémoriser sur `tasks` seul suffit. Le `eslint-disable` qui
    // couvrait la variable `today` disparaît avec elle.
  }, [tasks]);

  const totalTime = useMemo(() => todayTasks.reduce((sum, t) => sum + t.estimatedTime, 0), [todayTasks]);




  const handleCreateEventFromTask = (eventData: CreateEventInput) => {
    if (taskToEventModal) {
      createEventMutation.mutate({ ...eventData, taskId: taskToEventModal.id });
    }
    setTaskToEventModal(null);
  };

  const deleteTaskNow = (taskId: string) => {
    const snapshot = tasks.find(t => t.id === taskId);
    deleteMutation.mutate(taskId, {
      onSuccess: () => {
        setTaskToDelete(null);
        if (snapshot) {
          // Rend la tache sous SON identifiant : un id neuf la detacherait de
          // ses listes et de son KR, en silence (R-08, C-37).
          showUndoToast(t('todayTasks.deleted'), () => {
            restoreMutation.mutate(snapshot, {
              onSuccess: () => toast.success(t('todayTasks.restored')),
            });
          });
        }
      },
    });
  };

  // Tâche perso : suppression directe, réversible via le toast « Annuler ».
  // La popup de confirmation n'est gardée que pour les tâches collaboratives
  // (impact sur d'autres personnes, partages non restaurés par l'annulation).
  const handleDeleteClick = (task: Task) => {
    if (task.isCollaborative) {
      setTaskToDelete(task.id);
    } else {
      deleteTaskNow(task.id);
    }
  };

  const confirmDelete = () => {
    if (taskToDelete) deleteTaskNow(taskToDelete);
  };

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

  if (isLoadingTasks) {
    return (
      <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
        <div className="mb-6">
          <div className="h-5 w-32 bg-[rgb(var(--color-border))] rounded animate-pulse mb-2" />
          <div className="h-4 w-24 bg-[rgb(var(--color-border))] rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl border border-[rgb(var(--color-border))] animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-[rgb(var(--color-border))]" />
                <div className="flex-1">
                  <div className="h-4 w-48 bg-[rgb(var(--color-border))] rounded mb-2" />
                  <div className="h-3 w-32 bg-[rgb(var(--color-border))] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('sections.priorityTasks')}</h2>
          <p className="text-[rgb(var(--color-text-secondary))] text-label sm:text-sm">
            {tp('todayTasks.summary', todayTasks.length, {
              duration: `${Math.floor(totalTime / 60)}h${totalTime % 60}min`,
            })}
          </p>
        </div>

        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {todayTasks.map(task => (
            <TaskRow
              key={task.id}
              name={task.name}
              completeLabel={t('todayTasks.markDone', { name: task.name })}
              onComplete={() => toggleCompleteMutation.mutate(task.id)}
              onOpen={() => setSelectedTask(task)}
              compact={compact}
              actions={[
                { key: 'bookmark', label: t('todayTasks.bookmark'), icon: Bookmark, active: !!task.bookmarked, run: () => toggleBookmarkMutation.mutate(task.id) },
                { key: 'event', label: t('todayTasks.convertToEvent'), icon: Calendar, run: () => setTaskToEventModal(task) },
                { key: 'list', label: t('todayTasks.addToList'), icon: ListPlus, run: () => setAddToListTask(task.id) },
                { key: 'collab', label: t('todayTasks.collaboratorsTitle'), icon: UserPlus, run: () => setCollaboratorTaskId(task.id) },
                { key: 'delete', label: t('todayTasks.deleteTitle'), icon: Trash2, danger: true, run: () => handleDeleteClick(task) },
              ]}
            />
          ))}
        </ul>
        <div>
          {todayTasks.length === 0 && (
            <EmptyState
              icon={CheckSquare}
              title={tasks.length === 0 ? t('todayTasks.empty.noneTitle') : t('todayTasks.empty.clearTitle')}
              description={
                tasks.length === 0
                  ? t('todayTasks.empty.noneDescription')
                  : t('todayTasks.empty.clearDescription')
              }
              actionLabel={tasks.length === 0 ? t('todayTasks.empty.noneAction') : t('todayTasks.empty.clearAction')}
              onAction={() => navigate('/tasks')}
              accentColor="#3B82F6"
              compact
            />
          )}
        </div>
      </div>

      {/* TaskModal */}
      {selectedTask && (
        <TaskModal task={selectedTask} isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} />
      )}

      {/* EventModal — convert mode */}
      {taskToEventModal && (
        <EventModal
          mode="convert"
          isOpen={true}
          onClose={() => setTaskToEventModal(null)}
          task={taskToEventModal}
          onConvert={handleCreateEventFromTask}
        />
      )}

      {/* AddToListModal */}
      {addToListTask && (
        <AddToListModal isOpen={true} onClose={() => setAddToListTask(null)} taskId={addToListTask} />
      )}

      {/* Collaborateurs — réutilise la vue Collaborateurs de TaskModal (étape 2). */}
      {collaboratorTaskId && (() => {
        const collabTask = tasks.find(t => t.id === collaboratorTaskId);
        return collabTask ? (
          <TaskModal task={collabTask} isOpen onClose={() => setCollaboratorTaskId(null)} showCollaborators />
        ) : null;
      })()}

      {/* Delete confirmation */}
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

export default TodayTasks;
