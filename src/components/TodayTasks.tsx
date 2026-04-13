import React, { useState, useMemo } from 'react';
import { CheckSquare, Clock, Bookmark, AlertCircle, Calendar, MoreHorizontal, UserPlus, Trash2 } from 'lucide-react';
import CollaboratorAvatars from './CollaboratorAvatars';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import CollaboratorModal from './CollaboratorModal';

import { useTasks, useToggleTaskComplete, useToggleTaskBookmark, useDeleteTask, Task } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { useFriends } from '@/modules/friends';

const TodayTasks: React.FC = () => {
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);

  // Modals
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToEventModal, setTaskToEventModal] = useState<Task | null>(null);
  const [collaboratorTaskId, setCollaboratorTaskId] = useState<string | null>(null);

  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();
  const deleteMutation = useDeleteTask();
  const { data: categories = [] } = useCategories();
  const { data: friends = [] } = useFriends();

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

  const totalTime = useMemo(() => todayTasks.reduce((sum, task) => sum + task.estimatedTime, 0), [todayTasks]);

  const getCategoryData = (categoryId: string) => categories.find(cat => cat.id === categoryId);

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

  if (isLoadingTasks) {
    return (
      <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <div className="h-5 w-32 bg-[rgb(var(--color-border))] rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-[rgb(var(--color-border))] rounded animate-pulse" />
          </div>
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
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Tâches prioritaires</h2>
            <p className="text-[rgb(var(--color-text-secondary))] text-sm">
              {todayTasks.length} tâches • {Math.floor(totalTime / 60)}h{totalTime % 60}min
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {todayTasks.map(task => {
            const categoryData = getCategoryData(task.category);
            const cardColor = categoryData?.color || '#3B82F6';

            return (
              <div
                key={task.id}
                className={`group p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-md ${
                  task.isCollaborative ? 'collaborative-task' : ''
                } ${task.priority <= 2
                    ? 'bg-[rgb(var(--color-error)/0.35)] dark:bg-[rgb(var(--color-error)/0.45)] border-[rgb(var(--color-error)/0.6)] dark:border-[rgb(var(--color-error)/0.8)]'
                    : 'border-[rgb(var(--color-border))]'
                } ${completedTaskId === task.id ? 'animate-task-complete' : ''}`}
                style={task.priority > 2 ? {
                  backgroundColor: `${cardColor}25`,
                  borderColor: task.isCollaborative ? `${cardColor}50` : undefined,
                } : {}}
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
                    title={task.completed ? 'Marquer comme non faite' : 'Marquer comme faite'}
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
                        <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full shrink-0">
                          Collaboratif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[rgb(var(--color-text-secondary))]">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{task.estimatedTime} min</span>
                      </div>
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
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBookmarkMutation.mutate(task.id); }}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                      title="Favori"
                    >
                      <Bookmark size={15} className={task.bookmarked ? 'text-amber-500 fill-amber-500' : 'text-[rgb(var(--color-text-muted))]'} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTaskToEventModal(task); }}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                      title="Ajouter à l'agenda"
                    >
                      <Calendar size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                      title="Détails"
                    >
                      <MoreHorizontal size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCollaboratorTaskId(task.id); }}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                      title="Collaborateurs"
                    >
                      <UserPlus size={15} className="text-[rgb(var(--color-text-muted))]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(task.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Supprimer"
                    >
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

      {/* Modals */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {taskToEventModal && (
        <EventModal
          isOpen={!!taskToEventModal}
          onClose={() => setTaskToEventModal(null)}
          initialTask={taskToEventModal}
        />
      )}
      {collaboratorTaskId && (
        <CollaboratorModal
          taskId={collaboratorTaskId}
          onClose={() => setCollaboratorTaskId(null)}
        />
      )}
    </>
  );
};

export default TodayTasks;
