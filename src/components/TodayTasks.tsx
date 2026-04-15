import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Clock, Bookmark, AlertCircle, Calendar, MoreHorizontal, UserPlus, Trash2 } from 'lucide-react';
import CollaboratorAvatars from './CollaboratorAvatars';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import CollaboratorModal from './CollaboratorModal';
import AddToListModal from './AddToListModal';

import { useTasks, useToggleTaskComplete, useToggleTaskBookmark, useDeleteTask, Task } from '@/modules/tasks';
import { useCreateEvent, CreateEventInput } from '@/modules/events';
import { useCategories } from '@/modules/categories';
import { useFriends } from '@/modules/friends';

const TodayTasks: React.FC = () => {
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);

  // Modals
  const [selectedTask, setSelectedTask]             = useState<Task | null>(null);
  const [taskToEventModal, setTaskToEventModal]     = useState<Task | null>(null);
  const [addToListTask, setAddToListTask]           = useState<string | null>(null);
  const [collaboratorTaskId, setCollaboratorTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete]             = useState<string | null>(null);

  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();
  const toggleCompleteMutation  = useToggleTaskComplete();
  const toggleBookmarkMutation  = useToggleTaskBookmark();
  const deleteMutation          = useDeleteTask();
  const createEventMutation     = useCreateEvent();
  const { data: categories = [] } = useCategories();
  const { data: friends = [] }    = useFriends();

  const today = new Date();

  const todayTasks = useMemo(() => {
    return tasks
      .filter(task => !task.completed)
      .filter(task => {
        const taskDate = new Date(task.deadline);
        return taskDate.toDateString() === today.toDateString() || task.priority <= 2;
      })
      .sort((a, b) => {
        if (a.bookmarked && !b.bookmarked) return -1;
        if (!a.bookmarked && b.bookmarked) return 1;
        return a.priority - b.priority;
      })
      .slice(0, 5);
  }, [tasks]);

  const totalTime = useMemo(() => todayTasks.reduce((sum, t) => sum + t.estimatedTime, 0), [todayTasks]);

  const getCategoryData = (categoryId: string) => categories.find(c => c.id === categoryId);

  const getPriorityIcon = (priority: number) => {
    if (priority <= 2) return <AlertCircle size={16} className="text-[rgb(var(--color-error))]" />;
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

  const confirmDelete = () => {
    if (!taskToDelete) return;
    deleteMutation.mutate(taskToDelete, { onSuccess: () => setTaskToDelete(null) });
  };

  if (isLoadingTasks) {
    return (
      <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm">
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
      <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Tâches prioritaires</h2>
          <p className="text-[rgb(var(--color-text-secondary))] text-sm">
            {todayTasks.length} tâches • {Math.floor(totalTime / 60)}h{totalTime % 60}min
          </p>
        </div>

        <div className="space-y-3">
          {todayTasks.map(task => {
            const categoryData = getCategoryData(task.category);

            return (
              <div
                key={task.id}
                className={`group p-4 rounded-xl border border-[rgb(var(--color-border))] transition-all duration-300 cursor-pointer hover:shadow-md ${
                  task.isCollaborative ? 'collaborative-task' : ''
                } ${completedTaskId === task.id ? 'animate-task-complete' : ''}`}
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleComplete(task.id); }}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
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
                      <h3 className="font-semibold text-[rgb(var(--color-text-primary))] truncate">{task.name}</h3>
                      {getPriorityIcon(task.priority)}
                      {task.isCollaborative && (
                        <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full shrink-0">Collaboratif</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[rgb(var(--color-text-secondary))]">
                      <div className="flex items-center gap-1"><Clock size={14} /><span>{task.estimatedTime} min</span></div>
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryData?.color || '#CBD5E1' }} />
                        <span>P{task.priority}</span>
                      </div>
                      <div className="text-xs">{new Date(task.deadline).toLocaleDateString('fr-FR')}</div>
                    </div>
                  </div>

                  {/* Avatars collaborateurs */}
                  {task.isCollaborative && task.collaborators && (
                    <CollaboratorAvatars collaborators={task.collaborators} friends={friends} size="sm" />
                  )}

                  {/* Action icons — visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleBookmarkMutation.mutate(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title="Favori">
                      <Bookmark size={15} className={task.bookmarked ? 'text-amber-500 fill-amber-500' : 'text-[rgb(var(--color-text-muted))]'} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTaskToEventModal(task); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title="Convertir en événement">
                      <Calendar size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setAddToListTask(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title="Ajouter à une liste">
                      <MoreHorizontal size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setCollaboratorTaskId(task.id); }} className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors" title="Collaborateurs">
                      <UserPlus size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Supprimer">
                      <Trash2 size={15} className="text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {todayTasks.length === 0 && (
            <div className="text-center py-8 text-[rgb(var(--color-text-muted))]">
              <CheckSquare size={48} className="mx-auto mb-4 opacity-30" />
              <p>Aucune tâche prioritaire</p>
              <p className="text-sm">Toutes vos tâches urgentes sont terminées !</p>
            </div>
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

      {/* CollaboratorModal */}
      {collaboratorTaskId && (
        <CollaboratorModal isOpen={!!collaboratorTaskId} onClose={() => setCollaboratorTaskId(null)} taskId={collaboratorTaskId} />
      )}

      {/* Delete confirmation */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <Trash2 className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la tâche</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                >
                  Supprimer
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
