import React, { useState, useMemo } from 'react';
import { CheckSquare, Clock, Bookmark, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CollaboratorAvatars from './CollaboratorAvatars';

// Module tasks - Hooks indépendants
import { useTasks, useToggleTaskComplete, useToggleTaskBookmark } from '@/modules/tasks';

// Module categories - Migré
import { useCategories } from '@/modules/categories';

// TaskContext uniquement pour friends (domaine non migré)
import { useTasks as useTaskContext } from '../context/TaskContext';

const TodayTasks: React.FC = () => {
  const navigate = useNavigate();
  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (migré)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading: isLoadingTasks } = useTasks();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (migré)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  // ═══════════════════════════════════════════════════════════════════
  // FRIENDS - Depuis TaskContext (non migré)
  // ═══════════════════════════════════════════════════════════════════
  const { friends } = useTaskContext();

  // Tâches prioritaires pour aujourd'hui (mémoïsé pour performance)
  const todayTasks = useMemo(() => {
    return tasks
      .filter(task => !task.completed)
      .filter(task => {
        const taskDate = new Date(task.deadline);
        const today = new Date();
        return taskDate.toDateString() === today.toDateString() || task.priority <= 2;
      })
      .sort((a, b) => {
        // Trier par favoris puis par priorité
        if (a.bookmarked && !b.bookmarked) return -1;
        if (!a.bookmarked && b.bookmarked) return 1;
        return a.priority - b.priority;
      })
      .slice(0, 5); // Limiter à 5 tâches
  }, [tasks]);

  const totalTime = useMemo(() => {
    return todayTasks.reduce((sum, task) => sum + task.estimatedTime, 0);
  }, [todayTasks]);

  const getCategoryData = (categoryId: string) => {
    return categories.find(cat => cat.id === categoryId);
  };

  const getPriorityIcon = (priority: number) => {
    if (priority <= 2) return <AlertCircle size={16} className="text-[rgb(var(--color-error))]" />;
    return null;
  };

  // Handlers avec mutations
  const handleToggleComplete = (taskId: string) => {
    setCompletedTaskId(taskId);
    setTimeout(() => {
      toggleCompleteMutation.mutate(taskId);
      setCompletedTaskId(null);
    }, 600);
  };

  const handleToggleBookmark = (taskId: string) => {
    toggleBookmarkMutation.mutate(taskId);
  };

  // Loading state
  if (isLoadingTasks) {
    return (
      <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-[rgb(var(--color-accent)/0.15)] rounded-xl">
            <CheckSquare size={24} className="text-[rgb(var(--color-accent))]" />
          </div>
          <div>
            <div className="h-5 w-32 bg-[rgb(var(--color-border))] rounded animate-pulse mb-2"></div>
            <div className="h-4 w-24 bg-[rgb(var(--color-border))] rounded animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl border border-[rgb(var(--color-border))] animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-[rgb(var(--color-border))]"></div>
                <div className="flex-1">
                  <div className="h-4 w-48 bg-[rgb(var(--color-border))] rounded mb-2"></div>
                  <div className="h-3 w-32 bg-[rgb(var(--color-border))] rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-[rgb(var(--color-accent)/0.15)] rounded-xl">
          <CheckSquare size={24} className="text-[rgb(var(--color-accent))]" />
        </div>
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
          const isHovered = hoveredTaskId === task.id;
          
          return (
            <div 
              key={task.id}
              onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
              onMouseEnter={() => setHoveredTaskId(task.id)}
              onMouseLeave={() => setHoveredTaskId(null)}
              className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-md ${
                task.isCollaborative ? 'collaborative-task' : ''
              } ${task.priority <= 2 ? 'bg-[rgb(var(--color-error)/0.35)] dark:bg-[rgb(var(--color-error)/0.45)] border-[rgb(var(--color-error)/0.6)] dark:border-[rgb(var(--color-error)/0.8)]' : 'border-[rgb(var(--color-border))]'} ${
                completedTaskId === task.id ? 'animate-task-complete' : ''
              }`}
              style={!task.completed && task.priority > 2 ? {
                backgroundColor: isHovered ? `${cardColor}40` : `${cardColor}25`,
                borderColor: isHovered ? `${cardColor}70` : (task.isCollaborative ? `${cardColor}50` : undefined)
              } : {}}
            >

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleComplete(task.id);
                  }}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                    task.completed 
                      ? 'bg-[rgb(var(--color-error))] border-[rgb(var(--color-error))]' 
                      : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-error)/0.5)]'
                  }`}
                  title={task.completed ? "Marquer comme non faite" : "Marquer comme faite"}
                >
                  {task.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[rgb(var(--color-text-primary))]">{task.name}</h3>
                    {getPriorityIcon(task.priority)}
                    {task.isCollaborative && (
                      <span className="text-xs bg-[rgb(var(--color-accent))] text-white px-2 py-0.5 rounded-full">
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
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: categoryData?.color || '#CBD5E1' }}
                      ></span>
                      <span>P{task.priority}</span>
                    </div>
                    <div className="text-xs">
                      {new Date(task.deadline).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
              
                <div className="flex items-center gap-2">
                  {task.isCollaborative && task.collaborators && (
                    <CollaboratorAvatars collaborators={task.collaborators} friends={friends} size="sm" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBookmark(task.id);
                    }}
                    className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))]"
                  >
                    <Bookmark 
                      size={18} 
                      className={task.bookmarked ? 'favorite-icon filled' : 'text-[rgb(var(--color-text-muted))] hover:text-blue-500 dark:hover:text-blue-400'} 
                    />
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
  );
};

export default TodayTasks;
