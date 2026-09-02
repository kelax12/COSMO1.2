import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { CheckSquare, Clock, Bookmark, AlertCircle, Calendar, MoreHorizontal, UserPlus, Trash2 } from 'lucide-react';
import CollaboratorAvatars from './CollaboratorAvatars';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AddToListModal from './AddToListModal';
import EmptyState from './EmptyState';

import { useTasks, useToggleTaskComplete, useToggleTaskBookmark, useDeleteTask, useCreateTask, Task } from '@/modules/tasks';
import { useCreateEvent, CreateEventInput } from '@/modules/events';
import { useCategories } from '@/modules/categories';
import { useFriends, useSharesByTask } from '@/modules/friends';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { isDueToday } from '@/lib/deadline';

const TodayTasks: React.FC = () => {
  const { t, tp } = useT('dashboard');
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);

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
  const createMutation          = useCreateTask();
  const createEventMutation     = useCreateEvent();
  const { data: categories = [] } = useCategories();
  const { data: friends = [] }    = useFriends();
  const sharesByTask              = useSharesByTask();

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

  const getCategoryData = (categoryId: string) => categories.find(c => c.id === categoryId);

  const getPriorityIcon = (priority: number) => {
    if (priority > 0 && priority <= 2) return <AlertCircle size={16} className="text-[rgb(var(--color-error))]" />;
    return null;
  };

  const handleToggleComplete = (taskId: string) => {
    setCompletedTaskId(taskId);
    setTimeout(() => {
      toggleCompleteMutation.mutate(taskId);
      setCompletedTaskId(null);
    }, 600);
  };

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
          const { id: _id, createdAt: _ca, ...rest } = snapshot;
          showUndoToast(t('todayTasks.deleted'), () => {
            createMutation.mutate(rest, {
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

        <div className="space-y-3">
          {todayTasks.map(task => {
            const categoryData = getCategoryData(task.category);

            return (
              <div
                key={task.id}
                className={`group p-3 sm:p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-md ${
                  !task.bookmarked && task.isCollaborative ? 'collaborative-task' : ''
                } ${completedTaskId === task.id ? 'animate-task-complete' : ''}`}
                style={{
                  backgroundColor: task.bookmarked ? 'rgba(234, 179, 8, 0.15)' : undefined,
                  borderColor: task.bookmarked ? '#EAB308' : 'rgb(var(--color-border))',
                }}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={task.completed}
                    aria-label={task.completed ? t('todayTasks.markUndone', { name: task.name }) : t('todayTasks.markDone', { name: task.name })}
                    onClick={(e) => { e.stopPropagation(); handleToggleComplete(task.id); }}
                    className={`w-11 h-11 md:w-5 md:h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      task.completed
                        ? 'bg-[rgb(var(--color-error))] border-[rgb(var(--color-error))]'
                        : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-error)/0.5)]'
                    }`}
                  >
                    {task.completed && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-body sm:text-base text-[rgb(var(--color-text-primary))] truncate">{task.name}</h3>
                      {getPriorityIcon(task.priority)}
                      {task.sharedBy ? (
                        <span className="hidden md:inline-flex text-xs bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] px-2 py-0.5 rounded-full shrink-0" title={task.sharedBy}>
                          {task.sharedBy}
                        </span>
                      ) : task.isCollaborative ? (
                        (sharesByTask.get(task.id) ?? []).map((id) => {
                          const friend = friends.find((f) => f.userId === id || f.id === id || f.name === id);
                          const name = friend?.name ?? id;
                          return (
                            <span
                              key={id}
                              className="hidden md:inline-flex text-xs bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] px-2 py-0.5 rounded-full shrink-0"
                              title={name}
                            >
                              {name}
                            </span>
                          );
                        })
                      ) : null}
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-label sm:text-sm text-[rgb(var(--color-text-secondary))]">
                      <div className="flex items-center gap-1"><Clock size={14} /><span>{task.estimatedTime} min</span></div>
                      {task.priority > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryData?.color || '#CBD5E1' }} />
                          <span>{t('todayTasks.priority', { level: task.priority })}</span>
                        </div>
                      )}
                      <div className="text-caption sm:text-xs whitespace-nowrap">
                        {task.deadline ? formatDate(new Date(task.deadline)) : t('todayTasks.noDeadline')}
                      </div>
                    </div>
                  </div>

                  {/* Avatars collaborateurs */}
                  {(sharesByTask.get(task.id)?.length ?? 0) > 0 && (
                    <CollaboratorAvatars collaboratorIds={sharesByTask.get(task.id) ?? []} friends={friends} size="sm" />
                  )}

                  {/* Action icons — desktop hover only */}
                  <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleBookmarkMutation.mutate(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title="Favori">
                      <Bookmark size={15} className={task.bookmarked ? 'text-amber-500 fill-amber-500' : 'text-[rgb(var(--color-text-muted))]'} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTaskToEventModal(task); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title={t('todayTasks.convertToEvent')}>
                      <Calendar size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setAddToListTask(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title={t('todayTasks.addToList')}>
                      <MoreHorizontal size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setCollaboratorTaskId(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title={t('todayTasks.collaboratorsTitle')}>
                      <UserPlus size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(task); }} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title={t('todayTasks.deleteTitle')}>
                      <Trash2 size={15} className="text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

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
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[rgb(var(--color-border))]"
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
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
